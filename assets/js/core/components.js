import { icon } from './icons.js';
import { loadState,signIn,signUp,signOut } from './store.js';
export const navItems = [
  ['dashboard.html','home','Dashboard'],['trip.html','suitcase','Trips'],['editor.html','layout','Visual editor'],['templates.html','layers','Templates'],['assets.html','image','Assets']
];
export function appShell(content, active, options={}){
  const state=loadState(),user=state.currentUser||{},workspace=state.workspaces?.[0];
  const nav=navItems.map(([href,i,label])=>`<a class="side-nav-link ${active===href.split('.')[0]?'is-active':''}" href="${href}">${icon(i)}<span>${label}</span></a>`).join('');
  return `<div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="index.html"><span class="brand-mark">${icon('compass')}</span><span><strong>Wayfarer</strong><small>visual workspace</small></span></a>
      <div class="workspace-switch"><span class="workspace-avatar">${(workspace?.name||'W')[0]}</span><span><strong>${workspace?.name||'Your workspace'}</strong><small>${workspace?'Shared adventure space':'Sign in to begin'}</small></span>${icon('chevron')}</div>
      <nav class="side-nav">${nav}</nav>
      <div class="sidebar-foot"><a class="side-nav-link" href="#">${icon('users')}<span>Invite people</span></a><a class="side-nav-link" href="#">${icon('settings')}<span>Settings</span></a></div>
    </aside>
    <main class="main-shell">
      <header class="topbar"><button class="icon-button mobile-menu" data-menu aria-label="Open navigation">${icon('menu')}</button><div class="top-search">${icon('search')}<input aria-label="Search workspace" placeholder="Search trips, places, memories…"></div><div class="top-actions"><span class="save-note">${options.status || (state.auth?.signedIn?'Cloud connected':'Sign in to sync')}</span>${state.auth?.signedIn?`<button class="avatar-button" data-profile-menu aria-label="Open profile">${user.initials||'T'}</button><button class="signout-link" data-sign-out>Sign out</button>`:`<button class="button soft" data-open-auth>Sign in</button>`}</div></header>
      ${content}
    </main>
    <div class="scrim" data-scrim></div>
  </div>`;
}
export function pageHeader({eyebrow,title,description,actions=''}){return `<header class="page-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description?`<p class="page-description">${description}</p>`:''}</div><div class="page-actions">${actions}</div></header>`;}
export function button(label,{kind='primary',iconName='',attrs=''}={}){return `<button class="button ${kind}" ${attrs}>${iconName?icon(iconName):''}<span>${label}</span></button>`;}
export function projectCard(p){const dates=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'});return `<article class="project-card" data-project-id="${p.id}"><a href="trip.html?project=${p.id}" class="project-cover" style="background:${p.cover}"><span class="project-state ${p.state}">${p.state.replace('_',' ')}</span><span class="cover-art">${icon('plane')}</span></a><div class="project-card-body"><div><p class="card-kicker">${p.startDate?`${dates.format(new Date(p.startDate+'T12:00:00'))} to ${dates.format(new Date(p.endDate+'T12:00:00'))}`:'Dates open'}</p><h3><a href="trip.html?project=${p.id}">${p.title}</a></h3><p>${p.subtitle||''}</p></div><div class="progress-row"><div class="progress-track"><span style="width:${p.progress||0}%"></span></div><strong>${p.progress||0}%</strong></div><div class="card-meta"><div class="avatar-stack">${(p.collaborators||['A']).map(x=>`<span>${x}</span>`).join('')}</div><span>${p.state==='completed'?'Memory archive ready':'Planning in progress'}</span></div></div></article>`;}
export function toast(message){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';document.body.append(el)}el.textContent=message;el.classList.add('is-visible');setTimeout(()=>el.classList.remove('is-visible'),2600)}
export function authModal(){return `<div class="auth-backdrop" data-auth-modal aria-hidden="true"><section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button class="icon-button auth-close" data-close-auth aria-label="Close">×</button><div class="brand-mark">${icon('compass')}</div><p class="eyebrow">Your visual life workspace</p><h2 id="auth-title">Welcome to Wayfarer</h2><p class="auth-copy">Sign in to open your shared projects, personal views, and cloud-saved canvas designs.</p><div class="auth-tabs"><button class="is-active" data-auth-mode="signin">Sign in</button><button data-auth-mode="signup">Create account</button></div><form data-auth-form><label class="signup-only" hidden>Display name<input name="name" autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="current-password"></label><p class="auth-message" data-auth-message></p><button class="button primary full" type="submit" data-auth-submit>Sign in</button></form></section></div>`;}
export function bindAuth(){
  let mode='signin';const modal=document.querySelector('[data-auth-modal]');
  const open=()=>{modal?.classList.add('is-open');modal?.setAttribute('aria-hidden','false')};
  const close=()=>{if(!document.body.classList.contains('auth-required')){modal?.classList.remove('is-open');modal?.setAttribute('aria-hidden','true')}};
  document.querySelectorAll('[data-open-auth]').forEach(b=>b.onclick=open);document.querySelector('[data-close-auth]')?.addEventListener('click',close);
  if(document.body.classList.contains('auth-required'))open();
  document.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.authMode;document.querySelectorAll('[data-auth-mode]').forEach(x=>x.classList.toggle('is-active',x===button));document.querySelector('.signup-only').hidden=mode!=='signup';document.querySelector('[data-auth-submit]').textContent=mode==='signup'?'Create account':'Sign in';document.querySelector('[name=password]').autocomplete=mode==='signup'?'new-password':'current-password'});
  document.querySelector('[data-auth-form]')?.addEventListener('submit',async event=>{event.preventDefault();const form=new FormData(event.currentTarget),message=document.querySelector('[data-auth-message]'),submit=document.querySelector('[data-auth-submit]');submit.disabled=true;message.textContent='';try{if(mode==='signup'){await signUp(form.get('name'),form.get('email'),form.get('password'));message.textContent='Account created. Check your email if confirmation is enabled, then sign in.';mode='signin'}else{await signIn(form.get('email'),form.get('password'));location.reload()}}catch(error){message.textContent=error.message}finally{submit.disabled=false}});
  document.querySelector('[data-sign-out]')?.addEventListener('click',async()=>{await signOut();location.href='index.html'});
}
export function bindShell(){document.querySelector('[data-menu]')?.addEventListener('click',()=>document.body.classList.add('nav-open'));document.querySelector('[data-scrim]')?.addEventListener('click',()=>document.body.classList.remove('nav-open'));}
