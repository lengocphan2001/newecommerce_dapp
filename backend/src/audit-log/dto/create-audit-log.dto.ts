import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { AuditLogAction, AuditLogEntityType } from '../entities/audit-log.entity';

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  action: AuditLogAction;

  @IsString()
  @IsNotEmpty()
  entityType: AuditLogEntityType;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

