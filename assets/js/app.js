import { renderLanding } from './pages/landing.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderTrip } from './pages/trip.js';
import { renderEditor,initEditor } from './pages/editor.js';
import { renderTemplates } from './pages/templates.js';
import { renderAssets } from './pages/assets.js';
import { bindShell,toast } from './core/components.js';
const page=document.body.dataset.page;
const renderers={landing:renderLanding,dashboard:renderDashboard,trip:renderTrip,editor:renderEditor,templates:renderTemplates,assets:renderAssets};
document.querySelector('#app').innerHTML=renderers[page]?.()||renderLanding();
bindShell();
if(page==='editor')initEditor();
if(page==='assets'){
 const input=document.querySelector('[data-file-input]');document.querySelectorAll('[data-upload-open]').forEach(b=>b.onclick=()=>input.click());input.onchange=()=>{[...input.files].forEach(file=>{const url=URL.createObjectURL(file),grid=document.querySelector('[data-asset-grid]');grid.insertAdjacentHTML('afterbegin',`<article class="asset-card"><div class="asset-thumb"><img src="${url}" alt=""></div><div><strong>${file.name}</strong><small>Local upload • image</small></div><button class="icon-button">•••</button></article>`)});toast(`${input.files.length} asset${input.files.length===1?'':'s'} added locally`)};
}
document.querySelector('[data-new-project]')?.addEventListener('click',()=>toast('Project creation flow is ready for the next development phase.'));
document.querySelectorAll('[data-trip-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-trip-tab]').forEach(x=>x.classList.toggle('is-active',x===b));toast(`${b.dataset.tripTab} view is scaffolded for connection to project records.`)});
