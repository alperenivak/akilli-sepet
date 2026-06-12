import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty({ description: 'Firebase Cloud Messaging push bildirim tokeni' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fcmToken: string;
}
