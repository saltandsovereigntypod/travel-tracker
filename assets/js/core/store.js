const STORAGE_KEY = 'wayfarer-workspace-v1';
export const starterState = {
  currentUser: { id: 'user-ash', name: 'Ash', initials: 'A', plan: 'Personal workspace' },
  workspaces: [{ id: 'ws-family', name: 'Johnson Family Adventures', ownerId: 'user-ash', role: 'owner' }],
  projects: [
    { id: 'trip-japan', workspaceId: 'ws-family', type: 'travel', title: 'Japan 2027', subtitle: 'Tokyo, Kyoto and the quiet places between', state: 'planning', startDate: '2027-04-08', endDate: '2027-04-22', progress: 68, cover: 'linear-gradient(135deg,#9CCFE8,#FFF7ED 62%,#F4B183)', collaborators: ['A','D'], budget: 8400, spent: 3275 },
    { id: 'trip-yellowstone', workspaceId: 'ws-family', type: 'travel', title: 'Yellowstone Road Trip', subtitle: 'Seven slow days under wide skies', state: 'active', startDate: '2026-09-12', endDate: '2026-09-19', progress: 42, cover: 'linear-gradient(135deg,#F4B183,#FFF7ED 62%,#7FAFC9)', collaborators: ['A','D'], budget: 3100, spent: 860 },
    { id: 'trip-anniversary', workspaceId: 'ws-family', type: 'travel', title: 'Anniversary Weekend', subtitle: 'A little lake, a little room service', state: 'completed', startDate: '2026-06-18', endDate: '2026-06-21', progress: 100, cover: 'linear-gradient(135deg,#EFA88C,#FFF7ED 60%,#9CCFE8)', collaborators: ['A','D'], budget: 1200, spent: 1094 }
  ],
  records: [
    { id:'rec-flight-1', projectId:'trip-japan', type:'flight', title:'Delta 123', subtitle:'MSP to HND', start:'2027-04-08T11:40', end:'2027-04-09T15:10', status:'confirmed', cost:1240, shared:true },
    { id:'rec-hotel-1', projectId:'trip-japan', type:'hotel', title:'K5 Tokyo', subtitle:'Nihonbashi, Tokyo', start:'2027-04-09', end:'2027-04-14', status:'confirmed', cost:1460, shared:true },
    { id:'rec-dinner-1', projectId:'trip-japan', type:'restaurant', title:'Dinner at Narisawa', subtitle:'Minami Aoyama', start:'2027-04-11T19:00', status:'researching', cost:0, shared:true },
    { id:'rec-train-1', projectId:'trip-japan', type:'transport', title:'Shinkansen to Kyoto', subtitle:'Tokyo Station to Kyoto Station', start:'2027-04-14T09:30', status:'to-book', cost:180, shared:true },
    { id:'rec-pack-1', projectId:'trip-japan', type:'packing', title:'Passport and copies', status:'done', shared:true },
    { id:'rec-pack-2', projectId:'trip-japan', type:'packing', title:'Comfortable walking shoes', status:'packed', shared:false },
    { id:'rec-note-1', projectId:'trip-japan', type:'note', title:'Leave room for wandering', subtitle:'Do not schedule every afternoon.', status:'open', shared:false }
  ],
  templates: [
    { id:'tpl-weekend', name:'Weekend Escape', category:'Travel', style:'minimal', personal:false, shared:true },
    { id:'tpl-international', name:'International Adventure', category:'Travel', style:'journal', personal:false, shared:true },
    { id:'tpl-scrapbook', name:'Soft Scrapbook', category:'Dashboard', style:'scrapbook', personal:true, shared:false },
    { id:'tpl-logistics', name:'Calm Logistics', category:'Dashboard', style:'minimal', personal:true, shared:false },
    { id:'tpl-dark', name:'Dark Academia', category:'Dashboard', style:'dark', personal:false, shared:true },
    { id:'tpl-road', name:'Road Trip', category:'Travel', style:'adventure', personal:false, shared:true }
  ],
  assets: [
    { id:'asset-map', name:'Watercolor map', type:'background', collection:'Travel paper', src:'assets/images/watercolor-map.svg' },
    { id:'asset-stamp', name:'Passport stamp', type:'decoration', collection:'Travel paper', src:'assets/images/passport-stamp.svg' },
    { id:'asset-paper', name:'Cream paper texture', type:'texture', collection:'Soft stationery', src:'assets/images/paper-texture.svg' },
    { id:'asset-ticket', name:'Vintage ticket', type:'decoration', collection:'Travel paper', src:'assets/images/ticket.svg' }
  ],
  canvasDesigns: [{ id:'design-japan-dashboard', projectId:'trip-japan', ownerId:'user-ash', name:'Ash\'s Japan Journal', width:1200, height:800, scene:null, updatedAt:Date.now() }]
};
export function loadState(){
  try { return { ...structuredClone(starterState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return structuredClone(starterState); }
}
export function saveState(state){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function updateState(mutator){ const state=loadState(); mutator(state); saveState(state); return state; }
export function resetState(){ localStorage.removeItem(STORAGE_KEY); return loadState(); }
