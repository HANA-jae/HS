import { IsUrl, IsNotEmpty } from 'class-validator';

export class FetchUrlDto {
  @IsNotEmpty()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
    },
    { message: 'url must be a valid HTTP or HTTPS URL' },
  )
  url: string;
}
