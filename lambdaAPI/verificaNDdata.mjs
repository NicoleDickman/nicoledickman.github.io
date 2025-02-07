import { createHash } from 'node:crypto';
import { S3 } from '@aws-sdk/client-s3';

const s3 = new S3();
const BUCKET = 'nicoledickman.com';
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw6PC36Y7lYHbTuvOrbmGe4ynm2ZXD8K9V-CtdKeIBwzwkmynQ0FvdSLTIHRfWDH-7x/exec';

const computeMD5 = (data) =>
  createHash('md5').update(JSON.stringify(data)).digest('hex');

async function fetchSection(params) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('seccion', params.seccion);
  if (params.num !== undefined) url.searchParams.set('num', params.num);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
  return response.json();
};

async function updateIfNeeded(s3Key, data) {
  const newMD5 = computeMD5(data);
  try {
    const { ETag } = await s3.getObject({
      Bucket: BUCKET,
      Key: `data/${s3Key}`
    });
    if (ETag.replace(/"/g, '') === newMD5) return false;
  } catch (error) {
    if (error.name !== 'NoSuchKey') throw error;
  }
  await s3.putObject({
    Bucket: BUCKET,
    Key: `data/${s3Key}`,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  });
  return true;
};
export const handler = async () => {
  const secciones = await fetchSection({ seccion: 'secciones' });
  const sections = [];
  secciones.forEach(seccion => sections.push({ seccion: seccion, s3Key: `${seccion}.json` }));

  await Promise.all(sections.map(async ({ seccion, s3Key }) => {
    const data = await fetchSection({ seccion });
    const actualiza = await updateIfNeeded(s3Key, data);
    if (actualiza) console.log(`Se actualizó la sección ${seccion}.`);
    else console.log(`La sección ${seccion} no requiere actualización.`);
  }));

  // Procesar sección blog&num=0
  const initialBlog = await fetchSection({ seccion: 'blog', num: 0 });
  await updateIfNeeded('blog&num=0.json', initialBlog);

  // Procesar entradas restantes del blog
  const total = initialBlog.totalEntradas;
  for (let num = 1; num < total; num++) {
    const data = await fetchSection({ seccion: 'blog', num });
    await updateIfNeeded(`blog&num=${num}.json`, data);
  }
  console.log('Se actualizaron correctamente todos los datos.');
  return { status: 'OK' };
};