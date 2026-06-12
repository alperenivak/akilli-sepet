import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkAddCatalogPagesDto {
  @ApiProperty({
    description: 'Sayfa görsel URL listesi (sırayla eklenir)',
    type: [String],
    example: ['https://cdn.example.com/page1.jpg', 'https://cdn.example.com/page2.jpg'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  imageUrls: string[];
}
