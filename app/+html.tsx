import { type PropsWithChildren } from 'react';

const faviconSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  '<rect width="64" height="64" rx="14" fill="#0b1220"/>',
  '<path fill="#f59e0b" d="M17 15h10v14h10V15h10v34H37V36H27v13H17z"/>',
  '</svg>',
].join('');

const faviconHref = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link href={faviconHref} rel="icon" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
