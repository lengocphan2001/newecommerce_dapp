import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { writeFile } from 'fs/promises';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import sharp from 'sharp';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const WEBP_QUALITY = 78;
const WEBP_MAX_WIDTH = 1600;

function fileFilter(_req: any, file: Express.Multer.File, cb: any) {
  const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
  if (!isImage)
    return cb(new BadRequestException('Only image files are allowed'), false);
  cb(null, true);
}

function buildBaseUrl(req: any): string {
  const protocol =
    req.get('X-Forwarded-Proto') || (req.secure ? 'https' : req.protocol);
  return `${protocol}://${req.get('host')}`;
}

async function saveOptimizedImage(
  file: Express.Multer.File,
  prefix = '',
): Promise<string> {
  const originalExt = extname(file.originalname || '').toLowerCase();

  // Keep GIF as-is to avoid breaking animation content.
  if (file.mimetype === 'image/gif' || originalExt === '.gif') {
    const gifName = `${prefix}${randomUUID()}.gif`;
    await writeFile(join(UPLOAD_DIR, gifName), file.buffer);
    return gifName;
  }

  const webpName = `${prefix}${randomUUID()}.webp`;
  const outputPath = join(UPLOAD_DIR, webpName);
  const optimized = await sharp(file.buffer)
    .rotate()
    .resize({ width: WEBP_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer();
  await writeFile(outputPath, optimized);
  return webpName;
}

const singleUploadOptions = {
  storage: memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_SIZE },
};

const multiUploadOptions = {
  storage: memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_SIZE },
};

@Controller('uploads')
export class UploadController {
  /**
   * Upload a single image. Returns { url }.
   */
  @Post('image')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file', singleUploadOptions))
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const filename = await saveOptimizedImage(file);
    return { url: `${buildBaseUrl(req)}/files/${filename}` };
  }

  /**
   * Upload multiple images. Returns { urls }.
   */
  @Post('images')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FilesInterceptor('files', 20, multiUploadOptions))
  async uploadImages(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    if (!files?.length) throw new BadRequestException('Files are required');
    const filenames = await Promise.all(files.map((f) => saveOptimizedImage(f)));
    const baseUrl = buildBaseUrl(req);
    return { urls: filenames.map((f) => `${baseUrl}/files/${f}`) };
  }

  /**
   * Upload user avatar. Returns { url }.
   * Available for authenticated users (no AdminGuard required)
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', singleUploadOptions))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const filename = await saveOptimizedImage(file);
    return { url: `${buildBaseUrl(req)}/files/${filename}` };
  }

  /**
   * Upload ảnh chứng từ chuyển khoản (cho yêu cầu nạp tiền ví).
   * User đăng nhập có thể gọi (JwtAuthGuard, không cần AdminGuard).
   */
  @Post('deposit-proof')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', singleUploadOptions))
  async uploadDepositProof(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const filename = await saveOptimizedImage(file, 'deposit-');
    return { url: `${buildBaseUrl(req)}/files/${filename}` };
  }
}
