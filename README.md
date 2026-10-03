# rainreader
Simple Epub,Mobi,Azw webreader website


1.Organize Web Root Directory:Assemble all static app files into a clean web deployment directory. Verify that external vendor scripts (epub.js, Bootstrap icons) are either bundled locally in a lib/ directory or loaded via reliable CDN URLs.Plaintext/var/www/reader/
├── index.html
├── styles.css
├── app.js
├── lib/
│   └── epub.min.js
└── assets/
    └── icons/
2.Configure eBook MIME Types:Web servers must send correct Content-Type headers for .epub, .mobi, and .azw files. Without proper MIME types, browsers may reject downloaded eBook binary streams or fail to extract ZIP structures..epub: application/epub+zip.mobi: application/x-mobipocket-ebook.azw / .azw3: application/vnd.amazon.mobi8-ebook.wasm: application/wasm (if client-side WebAssembly tools are added later)3.Apply CORS and Isolation Headers:If your reader fetches eBooks hosted on external storage (like S3 buckets or remote URLs), Cross-Origin Resource Sharing (CORS) headers are required. Additionally, enabling isolation headers allows browser support for SharedArrayBuffer when using high-performance WebAssembly converters.PlaintextAccess-Control-Allow-Origin: *
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
4.Configure Web Server Engine:Deploy the configuration snippet matching your server software (Nginx, Apache, or static platforms like Vercel/Netlify) to handle routing, MIME types, and asset compression.5.Test and Verify Production Build:Deploy your files to the server and execute sanity checks across different devices and file formats.Open browser DevTools (F12) → Network Tab.Drag and drop a .epub file into the reader. Ensure no CORS or MIME type warnings appear in the console.Adjust font sizes and line heights on both desktop and mobile viewports to verify that .resize() executes cleanly without layout overflows.Web Server ConfigurationsNginx ConfigurationCreate or edit /etc/nginx/sites-available/reader:Nginxserver {
    listen 80;
    listen [::]:80;
    server_name reader.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reader.yourdomain.com;

    root /var/www/reader;
    index index.html;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/reader.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reader.yourdomain.com/privkey.pem;

    # Custom MIME types for eBook formats
    types {
        text/html                             html htm;
        text/css                              css;
        application/javascript                js;
        application/epub+zip                  epub;
        application/x-mobipocket-ebook        mobi;
        application/vnd.amazon.mobi8-ebook    azw azw3;
        application/wasm                      wasm;
    }

    # Enable Compression for eBook archives and web assets
    gzip on;
    gzip_types text/plain text/css application/javascript application/json application/epub+zip;
    gzip_min_length 1000;

    # CORS Headers
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static CSS/JS assets for 30 days
    location ~* \.(css|js|woff2?|svg|png|jpg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
Apache Configuration (.htaccess)Place this .htaccess file inside your web root directory (/var/www/html/):Apache# Register eBook MIME Types
AddType application/epub+zip .epub
AddType application/x-mobipocket-ebook .mobi
AddType application/vnd.amazon.mobi8-ebook .azw .azw3
AddType application/wasm .wasm

# Enable CORS Headers
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, OPTIONS"
</IfModule>

# Gzip Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/epub+zip
</IfModule>

# Prevent directory browsing
Options -Indexes
Netlify / Vercel ConfigurationFor static hosting providers, add a vercel.json file to your root project folder:JSON{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)\\.epub",
      "headers": [
        { "key": "Content-Type", "value": "application/epub+zip" }
      ]
    }
  ]
}
