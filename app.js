(function(){
  var EN = document.documentElement.lang === 'en';
  var BASE = EN ? '../' : './';
  var DATA_URL = BASE + (EN ? 'data-en.json' : 'data.json');
  var T = EN ? {
    cats:{ai:'AI & Software',freetoken:'Free Tokens',overseas:'Global Deals',gaming:'Games',digital:'Software',ecommerce:'E-commerce'},
    all:'All', free:'Free only', favs:'Saved', freeMark:'FREE', expired:'Expired',
    daysLeft:function(d,h){return d>0?('Ends in '+d+'d'):(h>0?('Ends in '+h+'h'):'Ending soon');},
    noDeadline:'No deadline stated', more:'How to claim & source', steps:'Steps', risk:'Watch out',
    elig:'Eligibility', region:'Region', source:'Source', tier:'Source tier ', open:'Open original page',
    empty:'No deals match.', expiring:function(n){return n+' deal(s) ending within 24 hours';},
    cost:{free:'Free',card:'Card required',qualified:'Eligibility required',paid:'Paid deal'},
    favTitle:'Save to my list', moreBtn:'Load more', shownOf:function(a,b){return 'Showing '+a+' of '+b;}
  } : {
    cats:{ai:'AI/软件/会员',freetoken:'免费Token',overseas:'海外精选',gaming:'游戏',digital:'数码软件',ecommerce:'电商'},
    all:'全部', free:'只看免费', favs:'想薅的', freeMark:'免费', expired:'已失效',
    daysLeft:function(d,h){return d>0?('剩 '+d+' 天'):(h>0?('剩 '+h+' 小时'):'即将截止');},
    noDeadline:'长期/未注明截止', more:'薅法与出处', steps:'领取步骤', risk:'风险提示',
    elig:'门槛', region:'地区', source:'出处原文', tier:'信源 ', open:'打开原页面',
    empty:'没有符合条件的线报。', expiring:function(n){return '有 '+n+' 条将在 24 小时内截止';},
    cost:{free:'免费',card:'需绑卡',qualified:'需资格',paid:'付费优惠'},
    favTitle:'收藏到想薅的', moreBtn:'加载更多', shownOf:function(a,b){return '已显示 '+a+' / 共 '+b+' 条';}
  };
  var PAGE=20;
  var state={cat:'all',q:'',favsOnly:false,sort:'newest',shown:PAGE};
  var favs=new Set(JSON.parse(localStorage.getItem('hao-favs')||'[]'));
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function highlight(title){
    var e=esc(title);
    return e.replace(/(\$\s?\d[\d,]*(\.\d+)?|\d+(\.\d+)?\s?%|\d+\s?折|[\d,]+\s?(亿|万)?\s?(Tokens|tokens|credits|Credits|Neurons|词元|元|GB|TB)|£\d[\d,]*|€\d[\d,]*)/g,'<span class="num">$1</span>');
  }
  function deadlineInfo(d){
    if(!d.deadline) return {text:T.noDeadline,urgent:false,expired:false};
    var end=new Date(d.deadline).getTime(), now=Date.now();
    if(end<now) return {text:T.expired,urgent:true,expired:true};
    var ms=end-now, days=Math.floor(ms/86400000), hrs=Math.floor(ms%86400000/3600000);
    return {text:T.daysLeft(days,hrs),urgent:ms<86400000,expired:false};
  }
  function render(data){
    var deals=data.deals.slice();
    var cats=[['all',T.all],['free',T.free],['favs',T.favs]];
    var seen={}; deals.forEach(function(d){ if(d.category&&!seen[d.category]){seen[d.category]=1; cats.push([d.category,T.cats[d.category]||d.category]);}});
    var chips=document.getElementById('chips');
    chips.innerHTML=cats.map(function(c){
      var on=(state.cat===c[0])?' on':'';
      return '<button class="chip'+on+'" data-cat="'+esc(c[0])+'">'+esc(c[1])+'</button>';
    }).join('');
    chips.querySelectorAll('.chip').forEach(function(b){ b.addEventListener('click',function(){ setCat(b.getAttribute('data-cat'),data); }); });
    var expiring=deals.filter(function(d){ var i=deadlineInfo(d); return !i.expired && d.deadline && (new Date(d.deadline).getTime()-Date.now()<86400000); }).length;
    document.getElementById('expire-note').textContent = expiring? T.expiring(expiring):'';
    var list=deals.filter(function(d){
      if(state.cat==='free' && d.costType!=='free') return false;
      if(state.cat==='favs' && !favs.has(d.id)) return false;
      if(state.cat!=='all'&&state.cat!=='free'&&state.cat!=='favs'&&d.category!==state.cat) return false;
      if(state.q){ var hay=(d.title+' '+d.benefit+' '+(d.subcategory||'')).toLowerCase(); if(hay.indexOf(state.q.toLowerCase())<0) return false; }
      return true;
    });
    function sinkRank(d){ var ex=deadlineInfo(d).expired?2:0; var pit=d.tier==='pitfall'?1:0; return ex+pit; }
    list.sort(function(a,b){
      var sa=sinkRank(a), sb=sinkRank(b); if(sa!==sb) return sa-sb;
      if(state.sort==='oldest') return a.id-b.id;
      if(state.sort==='expiring'){
        var ae=a.deadline?new Date(a.deadline).getTime():Infinity, be=b.deadline?new Date(b.deadline).getTime():Infinity;
        if(ae!==be) return ae-be;
        return b.id-a.id;
      }
      if(state.sort==='free'){
        var af=a.costType==='free'?0:1, bf=b.costType==='free'?0:1; if(af!==bf) return af-bf;
        return b.id-a.id;
      }
      return b.id-a.id; /* newest */
    });
    var total=list.length;
    var page=list.slice(0, state.shown);
    var countEl=document.getElementById('shown-count');
    if(countEl) countEl.textContent = total? T.shownOf(page.length, total):'';
    var main=document.getElementById('list');
    if(!list.length){ main.innerHTML='<p class="empty">'+T.empty+'</p>'; return; }
    main.innerHTML=page.map(function(d){
      var di=deadlineInfo(d);
      var meta=[ d.costType==='free'?'<span class="free">'+T.freeMark+' · '+esc(T.cost[d.costType]||d.costType)+'</span>':esc(T.cost[d.costType]||d.costType),
        esc(T.cats[d.category]||d.category), esc(d.regionAvailability||''),
        '<span class="'+(di.urgent?'urgent':'')+'">'+esc(di.expired?T.expired:di.text)+'</span>' ].join(' · ');
      var steps=(d.steps||[]).map(function(s){return '<li>'+esc(s)+'</li>';}).join('');
      var detail='<details class="deal-more"><summary>'+T.more+'</summary>'
        +(steps?'<p class="kv"><b>'+T.steps+'</b></p><ol>'+steps+'</ol>':'')
        +'<p class="kv"><b>'+T.elig+'</b>：'+esc(d.eligibility||'-')+'　<b>'+T.region+'</b>：'+esc(d.regionAvailability||'-')+'</p>'
        +(d.riskNote?'<p class="kv"><b>'+T.risk+'</b>：'+esc(d.riskNote)+'</p>':'')
        +(d.sourceQuote?'<blockquote>'+esc(d.sourceQuote)+'</blockquote>':'')
        +'<p class="src">'+T.tier+esc(d.sourceTier||'')+' · <a href="'+esc(d.sourceUrl)+'" target="_blank" rel="noopener">'+T.open+' ↗</a></p></details>';
      var perma=(EN?'en/deal/':'deal/')+d.id+'/';
      return '<article class="card">'
        +'<button class="fav'+(favs.has(d.id)?' on':'')+'" data-fav="'+d.id+'" title="'+T.favTitle+'">★</button>'
        +'<h3><a href="'+BASE+perma+'">'+highlight(d.title)+'</a></h3>'
        +'<p class="benefit">'+esc(d.benefit)+'</p>'
        +'<p class="meta">'+meta+'</p>'
        +detail+'</article>';
    }).join('');
    if(total>state.shown){
      var more=document.createElement('button');
      more.className='more-btn'; more.textContent=T.moreBtn+'（'+(total-state.shown)+'）';
      more.addEventListener('click',function(){ state.shown+=PAGE; render(data); });
      main.appendChild(more);
    }
    main.querySelectorAll('[data-fav]').forEach(function(b){ b.addEventListener('click',function(){
      var id=Number(b.getAttribute('data-fav'));
      if(favs.has(id)) favs.delete(id); else favs.add(id);
      localStorage.setItem('hao-favs',JSON.stringify(Array.from(favs)));
      render(data);
    });});
  }
  function setCat(c,data){ state.cat=c; state.shown=PAGE; render(data); }
  function boot(data){
    if(!data||!data.deals) { document.getElementById('list').innerHTML='<p class="empty">'+T.empty+'</p>'; return; }
    var iss=(data.issues||[])[0];
    if(iss){ var el=document.getElementById('issue-label'); if(el) el.textContent=iss.label; }
    render(data);
    document.getElementById('search').addEventListener('input',function(e){ state.q=e.target.value.trim(); state.shown=PAGE; render(data); });
    var sortEl=document.getElementById('sort');
    if(sortEl){ sortEl.addEventListener('change',function(e){ state.sort=e.target.value; state.shown=PAGE; render(data); }); }
  }
  fetch(DATA_URL).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(boot).catch(function(){ boot(window.__DATA__); });
})();
