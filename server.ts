import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import { createApiApp } from './src/server/api';

const modulePath=fileURLToPath(import.meta.url);
const isBuiltServer=path.basename(modulePath)==='server.mjs';
const projectRoot=isBuiltServer? path.dirname(path.dirname(modulePath)):path.dirname(modulePath);
dotenv.config({ path: path.join(projectRoot,'.env'),quiet: true });

export function getPortAndHost(args=process.argv.slice(2)) {
  let port=Number(process.env.PORT||3000);
  let host=process.env.HOST||'0.0.0.0';
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--port'||args[i]==='-p') port=Number(args[++i]);
    else if(args[i]==='--host'||args[i]==='-h') host=args[++i];
  }
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('PORT must be an integer between 1 and 65535');
  if(!host) throw new Error('HOST must not be empty');
  return { port,host };
}

export async function startServer() {
  const { port,host }=getPortAndHost();
  const app=createApiApp();
  if(isBuiltServer||process.env.NODE_ENV==='production') {
    const express=(await import('express')).default;
    const distPath=path.join(projectRoot,'dist');
    if(!existsSync(path.join(distPath,'index.html'))) throw new Error('Production build is missing. Run npm run build first.');
    app.use(express.static(distPath));
    app.get('*',(_req,res) => res.sendFile(path.join(distPath,'index.html')));
  } else {
    const { createServer }=await import('vite');
    const vite=await createServer({
      root: projectRoot,server: {
        middlewareMode: true,hmr: false,
        watch: process.env.DISABLE_HMR==='true'? null:{}
      },appType: 'spa'
    });
    app.use(vite.middlewares);
  }
  const server=await new Promise<import('node:http').Server>((resolve,reject) => {
    const listening=app.listen(port,host,() => resolve(listening));
    listening.once('error',reject);
  });
  console.log(`[Rodovid Server] Listening on http://${host}:${port}`);
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===modulePath) {
  startServer().then((server) => {
    let closing=false;
    const shutdown=() => {
      if(closing) return;
      closing=true;
      const timeout=setTimeout(() => process.exit(1),5000).unref();
      server.close((error) => { clearTimeout(timeout); process.exitCode=error? 1:0; });
      server.closeIdleConnections();
    };
    process.on('SIGTERM',shutdown);
    process.on('SIGINT',shutdown);
  }).catch((error) => {
    console.error('[Rodovid Server] Startup failed:',error.message);
    process.exitCode=1;
  });
}
