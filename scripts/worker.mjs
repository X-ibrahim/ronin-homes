async function handle(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/' || url.pathname==='/index.html'){
  return env.ASSETS.fetch(new Request(new URL('/index.html',url),request));
 }
 const normalized=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
 if(url.pathname==='/_next/image'||url.pathname==='/_next/image/'){
  const asset=url.searchParams.get('url');
  if(!asset)return new Response('Missing image',{status:400});
  const target=new URL(asset,'https://www.visiteamazonia.com.br');
  if(!['www.visiteamazonia.com.br','d2bv8dtly8iz1m.cloudfront.net'].includes(target.hostname))return new Response('Unknown image',{status:400});
  return Response.redirect(target.href,302);
 }
 if(routes[normalized]){
  const target=new URL(routes[normalized],url);
  const rsc=request.headers.get('RSC')==='1'||url.searchParams.has('_rsc');
  if(rsc)target.pathname=target.pathname.replace(/index.html$/,'route.rsc');
  const response=await env.ASSETS.fetch(new Request(target,{method:'GET'}));
  if(!response.ok)return response;
  return new Response(response.body,{status:200,headers:{'Content-Type':rsc?'text/x-component':'text/html; charset=utf-8','Cache-Control':'no-cache','Vary':'RSC, Next-Router-State-Tree, Next-Router-Prefetch'}});
 }
 return env.ASSETS.fetch(request);
}
export default {fetch:handle};
