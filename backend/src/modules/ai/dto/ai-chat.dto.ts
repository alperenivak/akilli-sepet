import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsNumber, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';

class ChatHistoryItemDto {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content: string;
}

export class AiChatDto {
  @ApiProperty({ example: 'Bana en yakın market nerede?' })
  @IsString()
  @MaxLength(500)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];

  @ApiPropertyOptional({ description: 'Kullanıcı enlemi (yakın market için)' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Kullanıcı boylamı' })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}
