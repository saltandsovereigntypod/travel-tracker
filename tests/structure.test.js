'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('all required pages and modular source files exist',()=>{for(const file of ['index.html','dashboard.html','trip.html','editor.html','templates.html','assets.html','assets/js/core/store.js','assets/js/services/editor-engine.js','README.md'])assert.ok(fs.existsSync(path.join(root,file)),file)});
test('workspace model separates projects records templates views and canvas designs',()=>{const store=read('assets/js/core/store.js');for(const key of ['workspaces','projects','records','templates','canvasDesigns'])assert.match(store,new RegExp(`${key}:`));assert.match(store,/ownerId/);assert.match(store,/shared:false/)});
test('editor exposes canvas operations and mobile controls',()=>{const engine=read('assets/js/services/editor-engine.js'),page=read('assets/js/pages/editor.js'),css=read('assets/css/styles.css');for(const action of ['addText','addShape','addChecklist','addDataCard','duplicate','toggleLock','layer','align','undo','redo','zoom'])assert.match(engine,new RegExp(`${action}\\(`));assert.match(page,/data-editor-action="delete"/);assert.match(css,/@media \(max-width:760px\)/)});
test('brand palette and no aggressive visual system',()=>{const css=read('assets/css/styles.css');for(const color of ['#F4B183','#EFA88C','#9CCFE8','#7FAFC9','#FFF7ED','#355C7D'])assert.ok(css.toUpperCase().includes(color.toUpperCase()))});
