import { icon } from './icons.js';
export const navItems = [
  ['dashboard.html','home','Dashboard'],['trip.html','suitcase','Trips'],['editor.html','layout','Visual editor'],['templates.html','layers','Templates'],['assets.html','image','Assets']
];
export function appShell(content, active, options={}){
  const nav=navItems.map(([href,i,label])=>`<a class="side-nav-link ${active===href.split('.')[0]?'is-active':''}" href="${href}">${icon(i)}<span>${label}</span></a>`).join('');
  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="index.html"><span class="brand-mark">${icon('compass')}</span><span><strong>Wayfarer</strong><small>visual workspace</small></span></a>
      <div class="workspace-switch"><span class="workspace-avatar">J</span><span><strong>Johnson Family</strong><small>Adventures</small></span>${icon('chevron')}</div>
      <nav class="side-nav">${nav}</nav>
      <div class="sidebar-foot"><a class="side-nav-link" href="#">${icon('users')}<span>Invite people</span></a><a class="side-nav-link" href="#">${icon('settings')}<span>Settings</span></a></div>
    </aside>
    <main class="main-shell">
      <header class="topbar"><button class="icon-button mobile-menu" data-menu aria-label="Open navigation">${icon('menu')}</button><div class="top-search">${icon('search')}<input aria-label="Search workspace" placeholder="Search trips, places, memories…"></div><div class="top-actions"><span class="save-note">${options.status || 'All changes saved'}</span><button class="avatar-button" aria-label="Open profile">A</button></div></header>
      ${content}
    </main>
    <div class="scrim" data-scrim></div>
  </div>`;
}
export function pageHeader({eyebrow,title,description,actions=''}){
 return `<header class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description?`<p class="page-description">${description}</p>`:''}</div><div class="page-actions">${actions}</div></header>`;
}
export function button(label,{kind='primary',iconName='',attrs=''}={}){return `<button class="button ${kind}" ${attrs}>${iconName?icon(iconName):''}<span>${label}</span></button>`;}
export function projectCard(p){
 const dates=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'});
 return `<article class="project-card" data-project-id="${p.id}"><a href="trip.html" class="project-cover" style="background:${p.cover}"><span class="project-state ${p.state}">${p.state}</span><span class="cover-art">${icon('plane')}</span></a><div class="project-card-body"><div><p class="card-kicker">${dates.format(new Date(p.startDate+'T12:00:00'))} to ${dates.format(new Date(p.endDate+'T12:00:00'))}</p><h3><a href="trip.html">${p.title}</a></h3><p>${p.subtitle}</p></div><div class="progress-row"><div class="progress-track"><span style="width:${p.progress}%"></span></div><strong>${p.progress}%</strong></div><div class="card-meta"><div class="avatar-stack">${p.collaborators.map(x=>`<span>${x}</span>`).join('')}</div><span>${p.state==='completed'?'Memory archive ready':'Planning in progress'}</span></div></div></article>`;
}
export function toast(message){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.append(el)}el.textContent=message;el.classList.add('is-visible');setTimeout(()=>el.classList.remove('is-visible'),2200)}
export function bindShell(){
 document.querySelector('[data-menu]')?.addEventListener('click',()=>document.body.classList.add('nav-open'));
 document.querySelector('[data-scrim]')?.addEventListener('click',()=>document.body.classList.remove('nav-open'));
}
