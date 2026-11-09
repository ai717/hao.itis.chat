#!/usr/bin/env node
/* AI薅羊毛日报 · SEO 同步引擎
 * 读 data.json + data-en.json：
 *  1) 再生 data-fallback.js / data-en-fallback.js
 *  2) 刷新中英首页 meta description、总数、issue 摘要与 JSON-LD ItemList
 *  3) 为每条 deal 生成 deal/<id>/index.html 与 en/deal/<id>/index.html
 *  4) 全量重建 sitemap.xml
 *  5) 生成 robots.txt
 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SITE = 'https://hao.itis.chat';

function readJson(p){ return JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8')); }
function write(p,content){ const fp=path.join(ROOT,p); fs.mkdirSync(path.dirname(fp),{recursive:true}); fs.writeFileSync(fp,content,'utf8'); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const zh = readJson('data.json');
const en = readJson('data-en.json');
if (zh.deals.length !== en.deals.length) throw new Error('中英条数不一致: '+zh.deals.length+' vs '+en.deals.length);
const enById = new Map(en.deals.map(d=>[d.id,d]));
for (const d of zh.deals) if(!enById.has(d.id)) throw new Error('英文缺 id '+d.id);

const issue = (zh.issues&&zh.issues[0])||{};
const issueEn = (en.issues&&en.issues[0])||{};
const lastmod = (issue.finishedAt||issue.label||'2026-11-09').slice(0,10);
const freeCount = zh.deals.filter(d=>d.costType==='free').length;
const freeCountEn = en.deals.filter(d=>d.costType==='free').length;

/* 1) fallback */
write('data-fallback.js', 'window.__DATA__ = '+JSON.stringify(zh)+';\n');
write('data-en-fallback.js', 'window.__DATA__ = '+JSON.stringify(en)+';\n');

/* 2) 首页 SEO */
function itemList(data, lang){
  return data.deals.map((d,i)=>({
    '@type':'ListItem', position:i+1,
    url: SITE + (lang==='en'?'/en':'') + '/deal/'+d.id+'/',
    name: d.title
  }));
}
function refreshHome(file, data, iss, fc, lang){
  const isEn = lang==='en';
  let html = fs.readFileSync(path.join(ROOT,file),'utf8');
  const total = data.deals.length;
  const desc = isEn
    ? 'AI Deals Daily: first-hand deal alerts every day, focused on free AI credits, software and membership freebies and curated global deals. '+total+' verified offers currently listed, '+fc+' of them free.'
    : 'AI薅羊毛日报：每天第一手薅羊毛线报，重点 AI/软件/会员白嫖与海外精选羊毛，免费优先。当前收录 '+total+' 条经核实的免费额度、会员试用、终身版神价与限免，其中免费 '+fc+' 条。';
  const rep = (re, val) => { html = html.replace(re, (m,g1,g2)=>g1+val+g2); };
  rep(/(<meta name="description" content=")[^"]*(")/, desc);
  rep(/(<meta property="og:description" content=")[^"]*(")/, desc);
  rep(/(<span data-sync="count">)[^<]*(<\/span>)/, String(total));
  rep(/(<span data-sync="freecount">)[^<]*(<\/span>)/, String(fc));
  if (iss && iss.summary) rep(/(<p class="issue-summary" data-sync="summary">)[^<]*(<\/p>)/, esc(iss.summary));
  if (iss && iss.label) rep(/(<h2 id="issue-label">)[^<]*(<\/h2>)/, esc(iss.label));
  const ld = {
    '@context':'https://schema.org','@graph':[
      {'@type':'WebSite', name: isEn?'AI Deals Daily':'AI薅羊毛日报', url: SITE+(isEn?'/en/':'/'), inLanguage: isEn?'en':'zh-CN', description: desc},
      {'@type':'ItemList', name: isEn?'Latest deal alerts':'最新羊毛线报', numberOfItems: total, itemListElement: itemList(data, lang)}
    ]};
  const ldStr = JSON.stringify(ld);
  // 清除首页 head 里从第一个 ld-main 块到最后一个 </script> 的整段（历史脏块内部含被写坏的 </script>，
  // 普通非贪婪匹配会残留半截 JSON 文本），再统一注入唯一一块
  const ldOpen = '<script type="application/ld+json" id="ld-main">';
  const firstLd = html.indexOf(ldOpen);
  if (firstLd >= 0) {
    const headEnd = html.indexOf('</head>');
    const lastClose = html.lastIndexOf('</script>', headEnd);
    if (lastClose > firstLd) html = html.slice(0, firstLd) + html.slice(lastClose + '</script>'.length);
  }
  // 再清掉游离在标签外的 ListItem 残片（脏块被 </script> 截断后留下的半截 JSON 文本）
  html = html.replace(/(^|>)([^<]*"@type":"ListItem"[^<]*)/g, '$1');
  html = html.replace(/<\/head>/, () => '<script type="application/ld+json" id="ld-main">\n'+ldStr+'\n</script>\n</head>');
  write(file, html);
}
refreshHome('index.html', zh, issue, freeCount, 'zh');
refreshHome(path.join('en','index.html'), en, issueEn, freeCountEn, 'en');

/* 3) 详情页 */
function dealPage(d, lang){
  const isEn = lang==='en';
  const url = SITE + (isEn?'/en':'') + '/deal/'+d.id+'/';
  const altUrl = SITE + (isEn?'':'/en') + '/deal/'+d.id+'/';
  const title = d.title + (isEn?' | AI Deals Daily':' | AI薅羊毛日报');
  const desc = (d.benefit||'').slice(0,160);
  const ld = {'@context':'https://schema.org','@graph':[
    {'@type':'Article', headline:d.title, description:d.benefit, datePublished:d.discoveredAt, dateModified:lastmod,
     inLanguage:isEn?'en':'zh-CN', mainEntityOfPage:url,
     author:{'@type':'Organization', name:isEn?'AI Deals Daily':'AI薅羊毛日报', url:SITE+'/'},
     publisher:{'@type':'Organization', name:isEn?'AI Deals Daily':'AI薅羊毛日报', url:SITE+'/'}},
    {'@type':'Offer', name:d.title, url:url, category:d.category,
     availability: d.deadline && new Date(d.deadline).getTime()<Date.now() ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
     ...(d.costType==='free' ? {price:'0', priceCurrency:'USD'} : {}),
     itemOffered:{'@type':'Thing', name:d.title, description:d.benefit},
     validThrough: d.deadline || undefined}
  ]};
  const L = isEn ? {back:'← All deals', steps:'How to claim', risk:'Watch out', elig:'Eligibility', region:'Region',
      deadline:'Deadline', none:'No deadline stated', source:'Source quote', open:'Open the original page', tier:'Source tier ',
      free:'FREE', expired:'Expired', home:'AI Deals Daily'}
    : {back:'← 全部线报', steps:'领取步骤', risk:'风险提示', elig:'门槛', region:'地区',
      deadline:'截止', none:'长期/未注明截止', source:'出处原文', open:'打开原页面', tier:'信源 ', free:'免费', expired:'已失效', home:'AI薅羊毛日报'};
  const CAT = isEn ? {ai:'AI & Software', overseas:'Global Deals', gaming:'Games', digital:'Software', ecommerce:'E-commerce'}
    : {ai:'AI/软件/会员', overseas:'海外精选', gaming:'游戏', digital:'数码软件', ecommerce:'电商'};
  const expired = d.deadline && new Date(d.deadline).getTime()<Date.now();
  const steps = (d.steps||[]).map(s=>'<li>'+esc(s)+'</li>').join('');
  return '<!DOCTYPE html>\n<html lang="'+(isEn?'en':'zh-CN')+'">\n<head>\n'
    +'<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-573LL74P"></script>\n'
    +'<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag(\'js\', new Date());\n</script>\n'
    +'<meta charset="UTF-8">\n'
    +'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    +'<title>'+esc(title)+'</title>\n'
    +'<meta name="description" content="'+esc(desc)+'">\n'
    +'<link rel="canonical" href="'+url+'">\n'
    +'<link rel="alternate" hreflang="'+(isEn?'zh':'en')+'" href="'+altUrl+'">\n'
    +'<link rel="alternate" hreflang="'+(isEn?'en':'zh')+'" href="'+url+'">\n'
    +'<meta property="og:type" content="article">\n<meta property="og:title" content="'+esc(d.title)+'">\n'
    +'<meta property="og:description" content="'+esc(desc)+'">\n<meta property="og:url" content="'+url+'">\n'
    +'<meta name="twitter:card" content="summary">\n'
    +'<link rel="icon" href="'+(isEn?'../../../':'../../')+'favicon.ico" sizes="any">\n'
    +'<link rel="icon" type="image/svg+xml" href="'+(isEn?'../../../':'../../')+'icon.svg">\n'
    +'<link rel="apple-touch-icon" href="'+(isEn?'../../../':'../../')+'apple-touch-icon.png">\n'
    +'<link rel="manifest" href="'+(isEn?'../../../':'../../')+'site.webmanifest">\n'
    +'<meta name="theme-color" content="#faf7f1">\n'
    +'<meta property="og:image" content="https://hao.itis.chat/icon-512.png">\n'
    +'<link rel="stylesheet" href="'+(isEn?'../../../':'../../')+'style.css">\n'
    +'<script type="application/ld+json">\n'+JSON.stringify(ld)+'\n</script>\n</head>\n<body>\n<div class="wrap deal-page">\n'
    +'<a class="back" href="../../">'+L.back+'</a>\n'
    +'<h1>'+esc(d.title)+'</h1>\n'
    +'<p class="benefit">'+esc(d.benefit)+'</p>\n'
    +'<p class="meta">'+(d.costType==='free'?'<span class="free">'+L.free+'</span> · ':'')+esc(CAT[d.category]||d.category)+' · '+esc(d.regionAvailability||'')+' · '+L.deadline+'：'+(d.deadline?esc(d.deadline.slice(0,10))+(expired?' · '+L.expired:''):L.none)+'</p>\n'
    +(steps?'<h2>'+L.steps+'</h2><ol>'+steps+'</ol>\n':'')
    +'<p class="kv"><b>'+L.elig+'</b>：'+esc(d.eligibility||'-')+'</p>\n'
    +'<p class="kv"><b>'+L.region+'</b>：'+esc(d.regionAvailability||'-')+'</p>\n'
    +(d.riskNote?'<p class="kv"><b>'+L.risk+'</b>：'+esc(d.riskNote)+'</p>\n':'')
    +(d.sourceQuote?'<h2>'+L.source+'</h2><blockquote style="border-left:3px solid #9c4a38;background:#f3e6e1;padding:8px 12px;margin:10px 0">'+esc(d.sourceQuote)+'</blockquote>\n':'')
    +'<p class="src">'+L.tier+esc(d.sourceTier||'')+' · <a href="'+esc(d.sourceUrl)+'" target="_blank" rel="noopener">'+L.open+' ↗</a></p>\n'
    +'<footer class="site">'+L.home+' · <a href="'+SITE+'/">hao.itis.chat</a></footer>\n</div>\n</body>\n</html>\n';
}
for (const dir of ['deal', path.join('en','deal')]) {
  const fp = path.join(ROOT, dir);
  if (fs.existsSync(fp)) fs.rmSync(fp, {recursive:true, force:true});
}
for (const d of zh.deals) write(path.join('deal', String(d.id), 'index.html'), dealPage(d, 'zh'));
for (const d of en.deals) write(path.join('en','deal', String(d.id), 'index.html'), dealPage(d, 'en'));

/* 4) sitemap */
const urls = [SITE+'/', SITE+'/en/'];
for (const d of zh.deals){ urls.push(SITE+'/deal/'+d.id+'/'); urls.push(SITE+'/en/deal/'+d.id+'/'); }
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
  + urls.map(u=>'  <url><loc>'+u+'</loc><lastmod>'+lastmod+'</lastmod></url>').join('\n') + '\n</urlset>\n';
write('sitemap.xml', sitemap);

/* 5) robots */
write('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: '+SITE+'/sitemap.xml\n');

console.log('sync ok: deals='+zh.deals.length+' free='+freeCount+' dealPages='+(zh.deals.length*2)+' sitemapUrls='+urls.length+' lastmod='+lastmod);
