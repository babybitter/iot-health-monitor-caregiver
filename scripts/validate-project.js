const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];

const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = path.join(directory, entry.name);
  if (entry.name === "node_modules" || entry.name === ".git") return [];
  return entry.isDirectory() ? walk(fullPath) : [fullPath];
});

const relative = file => path.relative(root, file).replace(/\\/g, "/");
const readJson = file => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${relative(file)}: JSON 解析失败 - ${error.message}`);
    return null;
  }
};

const allFiles = walk(root);
allFiles.filter(file => file.endsWith(".json") && !file.endsWith("package-lock.json")).forEach(readJson);

const appConfig = readJson(path.join(root, "app.json"));
if (appConfig) {
  const pageSet = new Set(appConfig.pages || []);
  pageSet.forEach(page => {
    [".js", ".json", ".wxml", ".wxss"].forEach(extension => {
      const file = path.join(root, `${page}${extension}`);
      if (!fs.existsSync(file)) errors.push(`${page}${extension}: app.json 已注册但文件不存在`);
    });
  });

  const tabPages = ((appConfig.tabBar && appConfig.tabBar.list) || []).map(item => item.pagePath);
  tabPages.forEach(page => {
    if (!pageSet.has(page)) errors.push(`app.json: tabBar 页面未注册 - ${page}`);
  });

  if (tabPages.some(page => /(^|\/)ai(?:-|\/|$)/i.test(page)) || (appConfig.pages || []).some(page => /(^|\/)ai(?:-|\/|$)/i.test(page))) {
    errors.push("app.json: 护工端不得包含 AI 助手路由");
  }
}

allFiles.filter(file => file.endsWith(".json")).forEach(file => {
  const data = readJson(file);
  if (!data || !data.usingComponents) return;
  Object.values(data.usingComponents).forEach(componentPath => {
    if (!componentPath.startsWith("/")) return;
    const target = path.join(root, `${componentPath.slice(1)}.json`);
    if (!fs.existsSync(target)) errors.push(`${relative(file)}: 组件不存在 - ${componentPath}`);
  });
});

allFiles.filter(file => file.endsWith(".js") && !relative(file).startsWith("ec-canvas/")).forEach(file => {
  const source = fs.readFileSync(file, "utf8");
  try {
    new vm.Script(source, { filename: relative(file) });
  } catch (error) {
    errors.push(`${relative(file)}: JavaScript 语法错误 - ${error.message}`);
  }

  const requirePattern = /require\(["'](\.{1,2}\/[^"']+)["']\)/g;
  let match;
  while ((match = requirePattern.exec(source))) {
    const target = path.resolve(path.dirname(file), match[1]);
    const candidates = [target, `${target}.js`, `${target}.json`, path.join(target, "index.js")];
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      errors.push(`${relative(file)}: 微信小程序不支持目录 require，请显式引用 index.js - ${match[1]}`);
    } else if (!candidates.some(candidate => fs.existsSync(candidate))) {
      errors.push(`${relative(file)}: require 引用不存在 - ${match[1]}`);
    }
  }
});

const authoredFiles = allFiles.filter(file => {
  const rel = relative(file);
  return /\.(js|json|wxml|wxss|md)$/.test(rel) && !rel.startsWith("ec-canvas/");
});

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
authoredFiles.forEach(file => {
  const text = fs.readFileSync(file, "utf8");
  if (emojiPattern.test(text)) errors.push(`${relative(file)}: 检测到 Emoji 或装饰性符号`);
  if (relative(file).endsWith(".wxml") && /\{\{[^}]*\.(slice|substring|map|filter)\s*\(/.test(text)) {
    errors.push(`${relative(file)}: WXML 表达式包含不受支持的方法调用`);
  }
  if (relative(file).endsWith(".wxss") && /(^|\s)width:\s*(7[5-9][1-9]|[89]\d{2,}|[1-9]\d{3,})rpx\s*;/m.test(text)) {
    errors.push(`${relative(file)}: 检测到可能造成页面溢出的超宽固定布局`);
  }
});

allFiles.filter(file => file.endsWith(".wxml") && !relative(file).startsWith("ec-canvas/")).forEach(file => {
  const scriptFile = file.replace(/\.wxml$/, ".js");
  if (!fs.existsSync(scriptFile)) return;
  const markup = fs.readFileSync(file, "utf8");
  const script = fs.readFileSync(scriptFile, "utf8");
  const eventPattern = /(?:bind|catch)(?::)?(?:tap|change|input|confirm|action|chooseavatar)="([A-Za-z_$][\w$]*)"/g;
  let match;
  while ((match = eventPattern.exec(markup))) {
    const handlerPattern = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?${match[1].replace(/\$/g, "\\$")}\\s*\\(`);
    if (!handlerPattern.test(script)) errors.push(`${relative(file)}: 事件处理函数不存在 - ${match[1]}`);
  }
});

const routePattern = /(?:url|path)\s*:\s*["'`]\/?(pages\/[a-z0-9-]+\/[a-z0-9-]+)/gi;
authoredFiles.filter(file => file.endsWith(".js")).forEach(file => {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = routePattern.exec(text))) {
    const target = match[1];
    if (appConfig && !(appConfig.pages || []).includes(target)) warnings.push(`${relative(file)}: 路由未在 app.json 注册 - ${target}`);
  }
});

if (errors.length) {
  console.error("Project validation failed:");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Project validation passed: ${allFiles.length} files checked.`);
if (warnings.length) {
  console.warn("Warnings:");
  warnings.forEach(warning => console.warn(`- ${warning}`));
}
