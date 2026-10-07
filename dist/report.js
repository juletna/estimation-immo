/* Dossier d'estimation : observations DVF et informations déclarées restent distinctes. */
(function (root) {
  'use strict';
  const quantile = (values, q) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a,b) => a-b), position = (sorted.length-1)*q;
    const i = Math.floor(position);
    return sorted[i] + (sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(position-i);
  };
  function summarize(sales, surface) {
    const prices = sales.map(s => s.sqm);
    return {count: prices.length, sqm: quantile(prices,.5), center: prices.length ? quantile(prices,.5)*surface : null,
      low: prices.length>=3 ? quantile(prices,.25)*surface : null, high: prices.length>=3 ? quantile(prices,.75)*surface : null};
  }
  function position(sales, surface, price, fees) {
    const stats = summarize(sales,surface);
    if (!Number.isFinite(price) || price<=0 || price>1000000000 || !Number.isFinite(fees) || fees<0 || fees>100) return null;
    return {sqm:price/surface, gap:stats.center ? (price/stats.center-1)*100 : null,
      cheaper:sales.length ? sales.filter(s=>s.sqm<price/surface).length/sales.length*100 : null,
      fee:price*fees/100, net:price*(1-fees/100)};
  }
  if (typeof module !== 'undefined') module.exports = {quantile,summarize,position};
  if (typeof document === 'undefined') return;
  const euros = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});
  const numbers = new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  const money = v => v===null ? '—' : euros.format(v);
  const num = v => numbers.format(Math.abs(v)<.05?0:v);
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = d => new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(d));
  const fields = ['property-title','configuration','rooms','units','condition','dpe','parking','terrace','veranda','garden','pool','ownership','description','strengths','concerns'];
  let state, container, map, resizeObserver, markers = new Map(), photo = '', photoVersion = 0, photoReady=Promise.resolve();
  document.querySelector('#property-photo').addEventListener('change', e => {photoReady=loadPhoto(e);});
  async function loadPhoto(e) {
    const version=++photoVersion, file=e.target.files[0], status=document.querySelector('#photo-status');
    photo='';
    if (!file) {status.textContent='Aucune photo sélectionnée.';return;}
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024) {
      e.target.value='';status.textContent='Choisissez un JPG, PNG ou WebP de moins de 5 Mo.';return;
    }
    status.textContent='Lecture de la photo…';
    try {
      const data = await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const image=new Image();image.src=data;await image.decode();
      if(version!==photoVersion)return;
      // Resize locally to keep the printable report lightweight.
      const canvas=document.createElement('canvas'), scale=Math.min(1,1400/image.width,1000/image.height);
      canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);photo=canvas.toDataURL('image/jpeg',.85);
      status.textContent='Photo prête, conservée uniquement pour ce dossier.';
    } catch {if(version===photoVersion){e.target.value='';status.textContent='Cette image ne peut pas être lue.';}}
  }
  async function collect(){await photoReady;return Object.fromEntries([...fields.map(id=>[id,document.getElementById(id).value.trim()]),['photo',photo]]);}
  function clear(resetPhoto=true){resizeObserver?.disconnect();if(map){map.remove();map=null;}markers.clear();state=null;if(resetPhoto){photo='';photoVersion++;document.querySelector('#photo-status').textContent='JPG, PNG ou WebP, 5 Mo maximum. La photo reste dans ce navigateur.';}}
  function active(){return state.picked.selected.filter(s=>!state.excluded.has(s.id));}
  function limitations(){
    const d=state.details, messages=[];
    if(d.configuration!=='Un logement'||Number(d.units)>1)messages.push('Configuration atypique ou plusieurs logements : les références DVF ne permettent pas de comparer leur agencement ni de valoriser séparément chaque logement.');
    if(d.condition)messages.push('État déclaré : '+d.condition.toLowerCase()+'. Aucun coût de travaux ni ajustement d’état n’est déduit des ventes.');
    else messages.push('État intérieur non renseigné : son incidence reste à examiner.');
    if(Number(d.terrace)>0||Number(d.veranda)>0||['Privatif','Commun'].includes(d.garden)||['Privative','Commune'].includes(d.pool))messages.push('Les extérieurs, la véranda et les équipements sont décrits, mais leur valeur n’est pas chiffrée. Les surfaces annexes ne sont pas ajoutées à la surface habitable.');
    if(d.parking==='Aucun')messages.push('Absence de stationnement déclarée : cet écart avec les références éventuelles n’est pas corrigé dans le calcul.');
    if(d.ownership==='Oui'||d.garden==='Commun'||d.pool==='Commune')messages.push('Copropriété ou espaces communs : les droits d’usage et charges restent à vérifier dans les documents du bien.');
    messages.push(d.dpe?'DPE déclaré : '+d.dpe+'. Les ventes retenues ne sont pas corrigées selon leur performance énergétique.':'DPE non renseigné : la performance énergétique n’est pas prise en compte.');
    return messages;
  }
  function show(input, element){
    clear(false);container=element;
    state={...input,details:input.details,excluded:new Map(),price:Math.round(summarize(input.picked.selected,input.surface).center),fees:0,created:new Date()};
    state.picked={...input.picked,selected:input.picked.selected.map((s,i)=>({...s,id:s.id||String(i),index:i+1})).sort((a,b)=>input.relevanceScore(b,input.surface)-input.relevanceScore(a,input.surface))};
    draw();
  }
  function draw(){
    if(map){map.remove();map=null;}markers.clear();
    const {details:d,type,surface,terrain,picked}=state;
    container.innerHTML=`<div class="output dossier">
      <section class="report-page summary-page"><div class="result-head"><div><p class="eyebrow">Dossier d’estimation · DVF</p><h2>Valeur indicative</h2></div><div class="result-actions"><button type="button" class="new-estimate-button">Nouvelle estimation</button><button type="button" class="print-button">Imprimer / enregistrer en PDF</button></div></div>
      <p class="address">${esc(state.feature.properties.label)}</p><p class="report-context">${esc(type)} · ${num(surface)} m² habitables${terrain?' · Terrain déclaré : '+num(terrain)+' m²':''} · ${date(state.created)}</p>
      <div id="summary-values" aria-live="polite"></div>
      <h3 class="section-title">Tester votre prix</h3><p class="note">Positionnement par rapport aux ventes enregistrées retenues. Ce prix envisagé ne modifie pas l’estimation.</p>
      <div class="fields price-fields"><div class="field"><label for="asking-price">Prix envisagé (€)</label><input id="asking-price" type="number" min="1" max="1000000000" step="1" value="${state.price}"></div><div class="field"><label for="agency-fees">Honoraires vendeur (%)</label><input id="agency-fees" type="number" min="0" max="100" step="0.1" value="${state.fees}"></div></div>
      <label class="help screen-only" for="price-slider">Ajuster le prix envisagé</label><input class="screen-only price-slider" id="price-slider" type="range" aria-label="Ajuster le prix envisagé" step="1000">
      <div id="position-summary" aria-live="polite"></div><div id="price-chart"></div>
      </section>
      <section class="report-page description-page"><p class="eyebrow">Votre bien</p><h3>${esc(d['property-title']||'Fiche descriptive')}</h3>
      ${d.photo?`<img class="report-photo" src="${d.photo}" alt="Photo du bien fournie par l’utilisateur">`:''}
      <dl class="property-facts">${[['Type',type],['Surface habitable',num(surface)+' m²'],['Configuration',d.configuration],['Logements',d.units],['Pièces',d.rooms],['État',d.condition],['DPE',d.dpe],['Stationnement',d.parking],['Terrasse',d.terrace?d.terrace+' m²':''],['Véranda',d.veranda?d.veranda+' m²':''],['Jardin',d.garden],['Piscine',d.pool],['Copropriété',d.ownership],['Contenance cadastrale',state.feature.properties.parcelArea?num(state.feature.properties.parcelArea)+' m² (parcelle entière)':'']].filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${d.description?`<p class="user-text">${esc(d.description)}</p>`:''}
      <div class="qualitative"><div><h4>Atouts déclarés</h4><p class="user-text">${esc(d.strengths||'Non renseignés')}</p></div><div><h4>Points à examiner</h4><p class="user-text">${esc(d.concerns||'Non renseignés')}</p></div></div>
      <p class="note">Informations déclaratives, sans ajustement automatique du prix. Les surfaces annexes restent distinctes de la surface habitable.</p>
      </section>
      <section class="report-page comparables-page"><p class="eyebrow">Les références</p><h3>Ventes comparables</h3><p class="note">Ouvrez un repère pour retrouver sa vente. Les coordonnées DVF peuvent correspondre à la parcelle.</p>
      <div id="sales-map" role="region" aria-label="Carte du bien et des ventes comparables"></div><p id="map-status" class="help" role="status"></p><p class="map-legend"><span>◆ Votre bien</span><span>● Ventes retenues</span><span>○ Ventes exclues</span></p>
      <p id="sales-count" class="note"></p><div id="sale-list" class="sales"></div>
      </section>
      <section class="report-page method-page"><p class="eyebrow">Comprendre l’estimation</p><h3>Hypothèses et limites</h3><div id="confidence-detail"></div>
      <ul class="limitations">${limitations().map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      <h4>Périmètre et méthode</h4><p>Recherche dans les secteurs cadastraux consultés de cette commune, jusqu’à ${num(picked.tier.km)} km sur ${picked.tier.months} mois. ${picked.tier.max===Infinity?'Sans restriction de surface.':`Surfaces de ${num(surface*picked.tier.min)} à ${num(surface*picked.tier.max)} m².`} ${picked.terrainApplied?'Filtre terrain : de 35 à 280 % du terrain déclaré, données manquantes admises.':'Aucun filtre sur le terrain.'}</p>
      <p>Valeur centrale = médiane des prix au m² retenus × ${num(surface)} m². La fourchette correspond aux 25e et 75e percentiles, projetés à cette surface ; ce n’est pas un intervalle de confiance. Elle apparaît à partir de trois ventes.</p>
      <p>Le score de pertinence classe les ventes : surface (45 points), distance (35), date (20). Il ne pondère pas la médiane. Les prix ne sont corrigés ni de l’état, ni des prestations, ni de l’évolution du marché.</p>
      <div id="exclusion-log"></div><div class="notice">Ce dossier est un repère statistique et ne constitue pas une expertise. Une mutation peut inclure d’autres biens ou dépendances non isolables dans les données reçues. La sélection manuelle peut déplacer la fourchette.</div>
      <div class="sources">Prix et dates : <a href="https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres" target="_blank" rel="noopener">DVF · DGFiP</a> (${state.sales.length} ventes exploitables repérées). Adresse et parcelle : IGN / cadastre. Fond cartographique : © OpenStreetMap. Les données DVF décrivent des transactions enregistrées, pas des annonces en cours. Aucune prévision de délai de vente.</div>
      </section></div>`;
    buildSales();update();buildMap();
    container.querySelector('#asking-price').addEventListener('input',e=>{state.price=e.target.value===''?NaN:Number(e.target.value);updatePosition();});
    container.querySelector('#agency-fees').addEventListener('input',e=>{state.fees=e.target.value===''?NaN:Number(e.target.value);updatePosition();});
    container.querySelector('#price-slider').addEventListener('input',e=>{state.price=Number(e.target.value);container.querySelector('#asking-price').value=state.price;updatePosition();});
  }
  function buildSales(){
    container.querySelector('#sale-list').innerHTML=state.picked.selected.map(s=>`<article class="sale report-sale" id="sale-${s.index}" tabindex="-1"><div class="sale-main"><div><strong><button type="button" class="map-link" data-locate="${s.index}">${s.index}. ${esc(s.street)}</button></strong><small>${date(s.date)} · ${num(s.area)} m² · ${s.rooms?s.rooms+' pièces · ':''}${num(s.km*1000)} m</small><span class="relevance">Pertinence ${state.relevanceScore(s,state.surface)}/100</span></div><div class="amount"><span class="amount-label">Prix vendu</span><strong>${money(s.price)}</strong><small>${num(s.sqm)} €/m²</small><div class="projection"><span>À votre surface</span><b>${money(s.sqm*state.surface)}</b></div></div></div>
      <div class="exclusion-controls screen-only"><label for="reason-${s.index}">Motif d’exclusion</label><div><input id="reason-${s.index}" maxlength="200" placeholder="Ex. : environnement différent"><button type="button" data-exclude="${s.index}">Exclure</button></div></div><p class="excluded-reason" hidden></p></article>`).join('');
    container.querySelectorAll('[data-locate]').forEach(b=>b.addEventListener('click',()=>{
      const marker=markers.get(Number(b.dataset.locate));if(marker&&map){map.setView(marker.getLatLng(),Math.max(map.getZoom(),15));marker.openPopup();container.querySelector('#sales-map').scrollIntoView({block:'center',behavior:'smooth'});}
    }));
    container.querySelectorAll('[data-exclude]').forEach(b=>b.addEventListener('click',()=>{
      const s=state.picked.selected.find(s=>s.index===Number(b.dataset.exclude)),input=container.querySelector('#reason-'+s.index);
      if(state.excluded.has(s.id)){state.excluded.delete(s.id);input.value='';}
      else {const reason=input.value.trim();if(!reason){input.setCustomValidity('Indiquez pourquoi cette vente est exclue.');input.reportValidity();input.focus();return;}state.excluded.set(s.id,reason);}
      update();
    }));
    container.querySelectorAll('.exclusion-controls input').forEach(input=>input.addEventListener('input',()=>input.setCustomValidity('')));
  }
  function update(){
    const selected=active(),stats=summarize(selected,state.surface),initial=summarize(state.picked.selected,state.surface);
    const weak=state.picked.tier.relaxed||selected.length&&quantile(selected.map(s=>state.relevanceScore(s,state.surface)),.5)<50;
    const confidence=!stats.count?'Aucune vente retenue':stats.count<3?'Repère très limité':weak?'Comparabilité faible':stats.count>=12?'Échantillon solide':stats.count>=6?'Échantillon modéré':'Échantillon limité';
    container.querySelector('#summary-values').innerHTML=`<span class="badge">${confidence}</span><div class="value">${money(stats.center)}</div><p class="range">${stats.low!==null?`Fourchette observée : <strong>${money(stats.low)} – ${money(stats.high)}</strong>`:stats.count?'Moins de trois ventes : aucune fourchette statistique.':'Réintégrez une vente pour retrouver un repère.'}</p><div class="metrics"><div class="metric"><b>${stats.count}</b><span>ventes retenues</span></div><div class="metric"><b>${stats.sqm===null?'—':num(stats.sqm)+' €'}</b><span>médiane par m²</span></div><div class="metric"><b>${state.excluded.size}</b><span>ventes exclues</span></div></div>${state.excluded.size?`<p class="note">Sélection initiale : ${money(initial.center)} · ${initial.count} ventes. ${stats.center!==null?'Écart après sélection : '+money(stats.center-initial.center)+'.':''}</p>`:''}`;
    container.querySelector('#confidence-detail').innerHTML=`<div class="selection-scope"><strong>${confidence}</strong>${stats.count} ventes retenues sur ${state.picked.selected.length} initialement sélectionnées.${selected.length?' Dernière vente : '+date(selected.map(s=>s.date).sort().at(-1))+'.':''} ${weak?'La recherche a été élargie ou les références ressemblent peu au bien.':''} La taille de l’échantillon ne garantit pas l’exactitude du prix.</div>`;
    container.querySelector('#sales-count').textContent=`${state.picked.selected.length} ventes consultables · ${stats.count} retenues dans le calcul. Le PDF détaille les six premières ventes retenues ; le calcul utilise toute la sélection.`;
    let printed=0;
    state.picked.selected.forEach(s=>{
      const excluded=state.excluded.has(s.id),card=container.querySelector('#sale-'+s.index),input=card.querySelector('input');
      card.classList.toggle('is-excluded',excluded);card.classList.toggle('omit-print',excluded||printed>=6);if(!excluded)printed++;
      input.disabled=excluded;card.querySelector('[data-exclude]').textContent=excluded?'Réintégrer':'Exclure';
      card.querySelector('.excluded-reason').hidden=!excluded;card.querySelector('.excluded-reason').textContent=excluded?'Exclue : '+state.excluded.get(s.id):'';
      const marker=markers.get(s.index);if(marker)marker.setIcon(markerIcon(s.index,excluded));
    });
    container.querySelector('#exclusion-log').innerHTML=state.excluded.size?`<h4>Exclusions manuelles (${state.excluded.size})</h4><ul>${state.picked.selected.filter(s=>state.excluded.has(s.id)).map(s=>`<li>${s.index}. ${esc(s.street)} · ${date(s.date)} · ${money(s.price)} : ${esc(state.excluded.get(s.id))}</li>`).join('')}</ul>`:'<p>Aucune exclusion manuelle.</p>';
    updatePosition();
  }
  function updatePosition(){
    const selected=active(),stats=summarize(selected,state.surface),p=position(selected,state.surface,state.price,state.fees),slider=container.querySelector('#price-slider');
    const base=stats.center||summarize(state.picked.selected,state.surface).center;
    slider.min=Math.max(1,Math.floor(base*.4/1000)*1000);slider.max=Math.ceil(Math.max(base*1.7,Number.isFinite(state.price)?state.price:0)/1000)*1000;slider.value=Number.isFinite(state.price)?state.price:base;
    container.querySelector('#position-summary').innerHTML=p?`<div class="position-result"><strong>${money(state.price)} · ${num(p.sqm)} €/m²</strong><p>${p.gap===null?'Aucune comparaison possible sans vente retenue.':`${p.gap>=0?'+':''}${num(p.gap)} % par rapport au repère médian ; ${num(p.cheaper)} % des ventes retenues ont un prix au m² inférieur.`}</p><p>Honoraires : ${money(p.fee)} · <strong>Net vendeur : ${money(p.net)}</strong></p><small>Honoraires à la charge du vendeur, calculés sur le prix envisagé. Hors autres frais, impôts et remboursement d’emprunt.</small></div>`:'<p class="notice">Saisissez un prix positif et des honoraires compris entre 0 et 100 %.</p>';
    container.querySelector('#price-chart').innerHTML=p?chart(selected,state.surface,state.price):'';
  }
  function chart(sales,surface,price){
    const maxX=Math.max(surface,...sales.map(s=>s.area))*1.15,maxY=Math.max(price,...sales.map(s=>s.price))*1.15;
    const x=v=>62+v/maxX*468,y=v=>205-v/maxY*175;
    return `<svg class="price-chart" viewBox="0 0 560 260" role="img" aria-label="Prix total selon la surface : les cercles représentent les ventes retenues, le losange votre prix envisagé"><title>Prix total selon la surface</title>${[0,.5,1].map(t=>`<line x1="62" x2="530" y1="${y(t*maxY)}" y2="${y(t*maxY)}" stroke="#dce6e9"/><text x="55" y="${y(t*maxY)+4}" text-anchor="end">${num(t*maxY/1000)} k€</text><text x="${x(t*maxX)}" y="225" text-anchor="middle">${num(t*maxX)}</text>`).join('')}${sales.map(s=>`<circle cx="${x(s.area)}" cy="${y(s.price)}" r="5" fill="#248794" opacity=".7"><title>${esc(s.street)} : ${num(s.area)} m², ${money(s.price)}</title></circle>`).join('')}<path d="M ${x(surface)} ${y(price)-8} l 8 8 -8 8 -8 -8 Z" fill="#a16a19"/><text x="65" y="250">● Ventes retenues · ◆ Prix envisagé</text><text x="530" y="250" text-anchor="end">Surface (m²)</text></svg>`;
  }
  function markerIcon(label,excluded=false){return L.divIcon({className:'numbered-marker'+(excluded?' marker-excluded':''),html:`<span>${label}</span>`,iconSize:[28,28],iconAnchor:[14,14]});}
  function buildMap(){
    if(!root.L){container.querySelector('#map-status').textContent='Carte indisponible. Toutes les ventes restent consultables ci-dessous.';return;}
    const [lon,lat]=state.feature.geometry.coordinates;
    map=L.map('sales-map',{scrollWheelZoom:false,fadeAnimation:false,zoomAnimation:false,markerZoomAnimation:false}).setView([lat,lon],14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).on('tileerror',()=>{if(state)container.querySelector('#map-status').textContent='Fond de carte indisponible ou incomplet. Les repères et la liste restent accessibles.';}).addTo(map);
    const home=L.marker([lat,lon],{icon:L.divIcon({className:'home-marker',html:'◆',iconSize:[30,30]}),title:'Votre bien'}).addTo(map).bindPopup('Votre bien');
    const bounds=[home.getLatLng()];
    state.picked.selected.forEach(s=>{
      if(!Number.isFinite(s.lat)||!Number.isFinite(s.lon))return;
      const marker=L.marker([s.lat,s.lon],{icon:markerIcon(s.index),title:`Vente ${s.index} : ${s.street}`}).addTo(map);
      const content=document.createElement('div');content.innerHTML=`<strong>${s.index}. ${esc(s.street)}</strong><p>${money(s.price)} · ${num(s.area)} m²</p>`;
      const link=document.createElement('button');link.type='button';link.textContent='Voir cette vente';link.addEventListener('click',()=>{const card=container.querySelector('#sale-'+s.index);card.focus();card.scrollIntoView({block:'center',behavior:'smooth'});});content.append(link);marker.bindPopup(content);markers.set(s.index,marker);bounds.push(marker.getLatLng());
    });
    map.fitBounds(bounds,{padding:[30,30],maxZoom:16});
    resizeObserver=new ResizeObserver(()=>{if(map)map.invalidateSize({pan:false});});resizeObserver.observe(container.querySelector('#sales-map'));
  }
  function prepareMapForPrint(){
    if(!map)return;
    map.closePopup();
    const element=container.querySelector('#sales-map');
    element.style.width='180mm';element.style.height='58mm';
    map.invalidateSize({pan:false,animate:false});
    const points=[state.feature.geometry.coordinates.slice().reverse(),...Array.from(markers.values(),m=>m.getLatLng())];
    map.fitBounds(points,{padding:[25,25],maxZoom:16,animate:false});
  }
  async function preparePrint(){
    prepareMapForPrint();
    if(!map)return;
    await new Promise(resolve=>{
      const started=Date.now();
      function check(){const images=Array.from(container.querySelectorAll('.leaflet-tile'));if(images.every(image=>image.complete)||Date.now()-started>4000)resolve();else setTimeout(check,100);}
      check();
    });
  }
  window.addEventListener('beforeprint',prepareMapForPrint);
  window.addEventListener('afterprint',()=>{
    if(!map)return;
    const element=container.querySelector('#sales-map');element.style.width='';element.style.height='';map.invalidateSize({pan:false});
  });
  root.PropertyReport={show,collect,clear,preparePrint,async print(){
    const button=container?.querySelector('.print-button');if(button)button.disabled=true;
    try{await preparePrint();window.print();}finally{if(button)button.disabled=false;}
  }};
})(typeof window !== 'undefined' ? window : globalThis);
