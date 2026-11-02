import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, readFile, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const magic=Buffer.from('FSBKP001');
const headerLength=20;
async function loadKey(file) {
  const text=(await readFile(file,'utf8')).trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(text)) throw new Error('Chave de backup deve conter 32 bytes aleatórios em base64.');
  return Buffer.from(text,'base64');
}
export async function encryptArchive(source,destination,keyFile) {
  const key=await loadKey(keyFile);
  const iv=randomBytes(12);
  const header=Buffer.concat([magic,iv]);
  const output=await open(destination,'wx',0o600);
  try {
    await output.write(header);
    const cipher=createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(header);
    await pipeline(createReadStream(source),cipher,createWriteStream(destination,{fd:output.fd,autoClose:false,start:header.length}));
    const info=await output.stat();
    await output.write(cipher.getAuthTag(),0,16,info.size);
    await output.sync();
  } catch(error) {await output.close().catch(()=>{});await unlink(destination).catch(()=>{});throw error;}
  await output.close();
}
export async function decryptArchive(source,destination,keyFile) {
  const key=await loadKey(keyFile);
  const input=await open(source,'r');
  let output;
  try {
    const size=(await input.stat()).size;
    if (size<headerLength+16) throw new Error('Backup truncado.');
    const header=Buffer.alloc(headerLength),tag=Buffer.alloc(16);
    await input.read(header,0,header.length,0);
    await input.read(tag,0,tag.length,size-16);
    if (!header.subarray(0,8).equals(magic)) throw new Error('Formato inválido.');
    const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8));
    decipher.setAAD(header);decipher.setAuthTag(tag);
    output=await open(destination,'wx',0o600);
    await pipeline(createReadStream(source,{start:headerLength,end:size-17}),decipher,createWriteStream(destination,{fd:output.fd,autoClose:false}));
    await output.sync();
  } catch(error) {
    if(output) {await output.close().catch(()=>{});output=undefined;await unlink(destination).catch(()=>{});}
    throw error;
  } finally {await input.close();if(output) await output.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [mode,source,destination,key]=process.argv.slice(2);
  if(!['encrypt','decrypt'].includes(mode)||!source||!destination||!key) {console.error('Uso: archive-crypto.mjs encrypt|decrypt origem destino arquivo-chave');process.exitCode=2;}
  else (mode==='encrypt'?encryptArchive:decryptArchive)(source,destination,key).catch(()=>{console.error('Operação de backup falhou. Verifique arquivos, chave e integridade; nenhum arquivo existente é sobrescrito.');process.exitCode=1;});
}
