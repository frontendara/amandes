import fs from 'node:fs/promises';

const dirs = await fs.readdir('./demos');

await fs.writeFile(
  './index.html',
  `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
   ${dirs
     .map((dir) => `<a href="/demos/${dir}/index.html">${dir}</a>`)
     .join('<br>\n   ')} 
</body>
</html>
`,
  'utf-8'
);
