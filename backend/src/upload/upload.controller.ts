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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

function fileFilter(_req: any, file: Express.Multer.File, cb: any) {
  const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
  if (!isImage) return cb(new BadRequestException('Only image files are allowed'), false);
  cb(null, true);
}

@Controller('uploads')
export class UploadController {
  /**
   * Upload a single image. Returns { url }.
   */
  @Post('image')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').toLowerCase() || '.png';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl}/files/${file.filename}` };
  }

  /**
   * Upload multiple images. Returns { urls }.
   */
  @Post('images')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').toLowerCase() || '.png';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB each
    }),
  )
  uploadImages(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    if (!files?.length) throw new BadRequestException('Files are required');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return { urls: files.map((f) => `${baseUrl}/files/${f.filename}`) };
  }

  /**
   * Upload user avatar. Returns { url }.
   * Available for authenticated users (no AdminGuard required)
   */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').toLowerCase() || '.png';
          cb(null, `${randomUUID()}${safeExt}`);
        },
      }),
      fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('File is required');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl}/files/${file.filename}` };
  }
}


