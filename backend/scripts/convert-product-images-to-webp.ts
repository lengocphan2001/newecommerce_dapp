import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, extname } from 'path';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { Product } from '../src/product/entities/product.entity';
import { Category } from '../src/category/entities/category.entity';

dotenv.config();

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const QUALITY = 78;
const MAX_WIDTH = 1600;

function buildDataSource() {
  const dbType = (process.env.DB_TYPE || 'postgres') as any;
  const isMySQL = dbType === 'mysql';
  return new DataSource({
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: [Product, Category],
    synchronize: false,
    logging: false,
  });
}

function extractFilename(url?: string | null): string | null {
  if (!url) return null;
  const marker = '/files/';
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.substring(idx + marker.length).split('?')[0];
}

function replaceFilenameInUrl(url: string, oldName: string, newName: string): string {
  return url.replace(`/files/${oldName}`, `/files/${newName}`);
}

async function convertFileToWebp(oldName: string): Promise<string | null> {
  const oldPath = join(UPLOAD_DIR, oldName);
  if (!existsSync(oldPath)) return null;
  const ext = extname(oldName).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return null;

  const source = await readFile(oldPath);
  const webpBuffer = await sharp(source)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 4 })
    .toBuffer();

  const newName = `${randomUUID()}.webp`;
  await writeFile(join(UPLOAD_DIR, newName), webpBuffer);
  return newName;
}

async function main() {
  const ds = buildDataSource();
  await ds.initialize();

  try {
    const repo = ds.getRepository(Product);
    const products = await repo.find();
    const convertedMap = new Map<string, string>();

    let changed = 0;
    let converted = 0;

    for (const p of products) {
      let dirty = false;

      if (p.thumbnailUrl) {
        const oldName = extractFilename(p.thumbnailUrl);
        if (oldName) {
          let newName = convertedMap.get(oldName);
          if (!newName) {
            newName = await convertFileToWebp(oldName) || undefined;
            if (newName) {
              convertedMap.set(oldName, newName);
              converted++;
            }
          }
          if (newName) {
            p.thumbnailUrl = replaceFilenameInUrl(p.thumbnailUrl, oldName, newName);
            dirty = true;
          }
        }
      }

      if (Array.isArray(p.detailImageUrls) && p.detailImageUrls.length > 0) {
        const nextUrls = [...p.detailImageUrls];
        for (let i = 0; i < nextUrls.length; i++) {
          const oldUrl = nextUrls[i];
          const oldName = extractFilename(oldUrl);
          if (!oldName) continue;
          let newName = convertedMap.get(oldName);
          if (!newName) {
            newName = await convertFileToWebp(oldName) || undefined;
            if (newName) {
              convertedMap.set(oldName, newName);
              converted++;
            }
          }
          if (newName) {
            nextUrls[i] = replaceFilenameInUrl(oldUrl, oldName, newName);
            dirty = true;
          }
        }
        if (dirty) {
          p.detailImageUrls = nextUrls;
        }
      }

      if (dirty) {
        await repo.save(p);
        changed++;
      }
    }

    console.log(
      `[convert-product-images-to-webp] Done. products_changed=${changed}, files_converted=${converted}`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[convert-product-images-to-webp] Failed:', err);
  process.exit(1);
});

