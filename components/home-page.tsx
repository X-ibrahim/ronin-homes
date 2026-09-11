'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { HeroFluid } from './hero-fluid';
import { tagOf, type CatalogCategory, type CatalogProduct } from '@/lib/catalog';

function AccountControl() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <a href="/sign-in" style={{ letterSpacing: '.1em' }}>
        Sign in
      </a>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'transparent', border: 0, color: 'inherit', font: 'inherit', letterSpacing: '.1em', cursor: 'pointer' }}
      >
        {user.firstName || 'Account'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '32px',
            right: 0,
            zIndex: 20,
            minWidth: '200px',
            padding: '16px',
            background: '#f4e9d7',
            color: '#071b13',
            fontSize: '13px',
          }}
        >
          <p style={{ margin: '0 0 12px', wordBreak: 'break-all', color: '#5a5347' }}>
            {user.primaryEmailAddress?.emailAddress}
          </p>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            style={{ width: '100%', border: '1px solid #071b13', background: 'transparent', color: '#071b13', borderRadius: '99px', padding: '9px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function HomePage({ categories, products }: { categories: CatalogCategory[]; products: CatalogProduct[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState('all');
  const [cart, setCart] = useState<CatalogProduct[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const visible = products.filter(p => filter === 'all' || p.categoryId === categories.find(c => c.slug === filter)?.id);

  const addToCart = (product: CatalogProduct) => {
    setCart(c => [...c, product]);
    setCartOpen(true);
  };
  const removeFromCart = (i: number) => setCart(c => c.filter((_, idx) => idx !== i));
  const cartTotal = cart.reduce((sum, p) => sum + p.price, 0);

  // Drives the --mx/--my custom properties the hero heading's skew transform
  // reads (see the embedded CSS in app/layout.tsx).
  useEffect(() => {
    const root = document.documentElement;
    const onMove = (e: PointerEvent) => {
      root.style.setProperty('--mx', `${e.clientX - window.innerWidth / 2}px`);
      root.style.setProperty('--my', `${e.clientY - window.innerHeight / 2}px`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <>
      <header className="nav">
        <a href="/">
          <img className="logo" src="/ronin-assets/ronin-hmx-logo.png" alt="Ronin HMX — Ronin Homes" />
        </a>
        <nav className="navlinks">
          <a href="#shop">Shop</a>
          <a href="#story">Our world</a>
          <a href="#journal">Journal</a>
        </nav>
        <div className="navactions">
          <AccountControl />
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            Bag <span>{cart.length}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" ref={heroRef}>
          <div className="hero-copy">
            <div className="kicker">Ronin Homes presents</div>
            <h1>
              Make
              <br />
              space
              <br />
              loud.
            </h1>
            <p>Anime energy, made at home. Tufted rugs, soft goods and little objects for rooms with a point of view.</p>
            <a className="cta" href="#shop">
              Explore the drop <span>↘</span>
            </a>
          </div>
        </section>
        <HeroFluid target={heroRef} />

        <div className="ticker">
          <span className="ticker-track">
            RONIN HMX&nbsp;&nbsp;&nbsp; HOMEWARE FOR THE MAIN CHARACTER&nbsp;&nbsp;&nbsp; RONIN HMX&nbsp;&nbsp;&nbsp; HOMEWARE FOR
            THE MAIN CHARACTER&nbsp;&nbsp;&nbsp;
          </span>
        </div>

        <section className="chapter chapter-blue">
          <div className="chapter-inner">
            <span className="kicker">A room can be a portal</span>
            <h2>
              Collect
              <br />
              your world.
            </h2>
            <p>Color, texture, character. Build a home that feels like the opening scene.</p>
          </div>
          <img src="/ronin-assets/butterfly-dream.png" alt="Butterfly tufted rug" />
        </section>

        <section className="section shell" id="shop">
          <div className="section-head">
            <h2>
              The current
              <br />
              drop
            </h2>
            <p>Pieces with enough personality to anchor a room. Small-batch, made to be lived with.</p>
          </div>
          <div className="filters">
            <button className={'filter' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>
              All pieces
            </button>
            {categories.map(c => (
              <button key={c.id} className={'filter' + (filter === c.slug ? ' active' : '')} onClick={() => setFilter(c.slug)}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="grid">
            {visible.map(p => {
              const tag = tagOf(p);
              return (
                <article className="product" key={p.id}>
                  <div className="product-media">
                    <img src={p.images[0]} alt={p.title} />
                  </div>
                  {tag && <span className="badge">{tag}</span>}
                  <h3>{p.title}</h3>
                  <div className="meta">
                    <b>${p.price}</b>
                    <button className="add" onClick={() => addToCart(p)}>
                      Add to bag +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="story" id="story">
          <div className="shell">
            <div className="kicker">Why Ronin HMX</div>
            <h2>
              Home is
              <br />
              your arc.
            </h2>
            <p>
              Ronin HMX stands for Ronin Homes: a front door for expressive people. We pair anime references with tactile craft
              so your space feels collected, not copied.
            </p>
            <a className="cta" href="#journal">
              Read the story <span>↗</span>
            </a>
          </div>
          <img src="/ronin-assets/sakura-anime.png" alt="Sakura anime tufted rug" />
        </section>

        <section className="section shell" id="journal">
          <div className="section-head">
            <h2>
              Good things
              <br />
              to come
            </h2>
            <p>New drops, studio notes and room tours—straight to your inbox.</p>
          </div>
          <div className="perks">
            <div className="perk">
              <b>01 /</b>
              <p>Original, anime-inspired pieces designed for everyday rooms.</p>
            </div>
            <div className="perk">
              <b>02 /</b>
              <p>Small runs so your favourite piece still feels like yours.</p>
            </div>
            <div className="perk">
              <b>03 /</b>
              <p>Free shipping on orders over $150. Easy returns within 30 days.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner shell">
          <div className="footer-top">
            <img className="footer-logo" src="/ronin-assets/ronin-hmx-logo.png" alt="Ronin HMX" />
            <nav className="footer-links">
              <a href="#">Ronin Prx</a>
              <a href="#">Ronin Apx</a>
              <a href="#">Ronin Clx</a>
              <a href="#">Ronin Mgx</a>
              <a href="#">Ronin</a>
            </nav>
          </div>
          <div className="footer-bottom">
            <small>© 2026 Ronin Homes. Built for rooms with a point of view.</small>
            <small>Instagram&nbsp;&nbsp; Pinterest&nbsp;&nbsp; hello@roninhmx.com</small>
          </div>
        </div>
      </footer>

      <aside className={'cart-drawer' + (cartOpen ? ' open' : '')}>
        <div className="cart-backdrop" onClick={() => setCartOpen(false)} />
        <div className="cart-panel">
          <button className="close" onClick={() => setCartOpen(false)}>
            ×
          </button>
          <h2>Your bag</h2>
          <div>
            {cart.length === 0 ? (
              <p>Your bag is waiting for its first main character.</p>
            ) : (
              cart.map((p, i) => (
                <div className="cart-row" key={`${p.id}-${i}`}>
                  <img src={p.images[0]} alt="" />
                  <div>
                    <b>{p.title}</b>
                    <br />
                    <small>${p.price}</small>
                  </div>
                  <button className="close" onClick={() => removeFromCart(i)}>
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="cart-total">
            <span>Total</span>
            <span>${cartTotal}</span>
          </div>
          <button className="checkout">Checkout</button>
        </div>
      </aside>
    </>
  );
}
