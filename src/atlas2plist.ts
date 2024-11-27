import { readdirSync, statSync, writeFileSync } from "fs";
import { readFileSync } from "fs";
import { extname } from "path";
import { join } from "path";
import { dirname } from "path";
import { argv } from "process";

interface IAtlasData {
    name: string, size: { width: number, height: number },
    format: string, filter: string, repeat: string,
    frames: IAtlasFrameData[]
}
interface IAtlasFrameData {
    name: string, rotate: boolean, xy: { x: number, y: number },
    size: { width: number, height: number }, orig: { width: number, height: number },
    offset: { x: number, y: number }, index: number
}

// 解析 Spine Atlas 格式
function parseAtlas(atlasText: string) {
    let atlasData: IAtlasData = null;

    // 解析图集文件的基本信息
    const generalInfoRegex = /(\S+\.png)\nsize:\s(\d+),(\d+)\nformat:\s(\S+)\nfilter:\s([\w,]+)\nrepeat:\s(\S+)/;
    const generalInfoMatch = atlasText.match(generalInfoRegex);
    if (generalInfoMatch) {
        atlasData = {
            name: generalInfoMatch[1],
            size: { width: parseInt(generalInfoMatch[2]), height: parseInt(generalInfoMatch[3]) },
            format: generalInfoMatch[4], filter: generalInfoMatch[5], repeat: generalInfoMatch[6],
            frames: []
        }
    } else {
        return;
    }

    // 解析每个纹理图集项
    const frames = atlasData.frames;
    const textureRegex = /(\S+)\n\s*rotate:\s(\w+)\n\s*xy:\s(\d+),\s*(\d+)\n\s*size:\s(\d+),\s*(\d+)\n\s*orig:\s(\d+),\s*(\d+)\n\s*offset:\s(\d+),\s*(\d+)\n\s*index:\s(-?\d+)/g;
    let match: RegExpExecArray;
    while ((match = textureRegex.exec(atlasText)) !== null) {
        frames.push({
            name: match[1],
            rotate: match[2] === 'true',
            xy: { x: parseInt(match[3]), y: parseInt(match[4]) },
            size: { width: parseInt(match[5]), height: parseInt(match[6]) },
            orig: { width: parseInt(match[7]), height: parseInt(match[8]) },
            offset: { x: parseInt(match[9]), y: parseInt(match[10]) },
            index: parseInt(match[11])
        })
    }

    return atlasData;
}

function generatePlist(data: string) {
    let plistContent =  `<?xml version="1.0" encoding="UTF-8"?>\n`;
    plistContent +=     `<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n`;
    plistContent +=     `<plist version="1.0">\n`;
    plistContent +=         `<dict>\n`;
    plistContent +=             data;
    plistContent +=         `</dict>\n`;
    plistContent +=     `</plist>\n`;
    return plistContent;
}

function generatePlistMeta(atlasData: IAtlasData) {
    let plistContent = '';
    plistContent +=     `<key>metadata</key>\n`;
    plistContent +=     `<dict>\n`;
    plistContent +=         `<key>format</key>\n`;
    plistContent +=         `<integer>3</integer>\n`;
    plistContent +=         `<key>pixelFormat</key>\n`;
    plistContent +=         `<string>${atlasData.format}</string>\n`;
    plistContent +=         `<key>premultiplyAlpha</key>\n`;
    plistContent +=         `<false/>\n`;
    plistContent +=         `<key>realTextureFileName</key>\n`;
    plistContent +=         `<string>${atlasData.name}</string>\n`;
    plistContent +=         `<key>size</key>\n`;
    plistContent +=         `<string>{${atlasData.size.width},${atlasData.size.height}}</string>\n`;
    plistContent +=         `<key>smartupdate</key>\n`;
    plistContent +=         `<string><string>$TexturePacker:SmartUpdate:1b5bccb0d946cdece259a442890522fa:d1f71fbb82ab986541e20c2fd9691d45:9a3d8c457b352bd8184ece2e6957f9ca$</string>\n`;
    plistContent +=         `<key>textureFileName</key>\n`;
    plistContent +=         `<string>${atlasData.name}</string>\n`;
    plistContent +=     `</dict>\n`;
    return plistContent;
}

function getSpriteOffset(frame: IAtlasFrameData) {
    const { orig, size, offset } = frame;
    const offsetX = offset.x + size.width * 0.5 - orig.width * 0.5;
    const offsetY = offset.y + size.height * 0.5 - orig.height * 0.5;
    return `{${offsetX},${offsetY}}`;
}

function generatePlistFrames(atlasData: IAtlasData) {
    let plistContent = '';
    plistContent += `<key>frames</key>\n`;
    plistContent += `<dict>\n`;
    for (let g = 0; g < atlasData.frames.length; g++) {
        const frame = atlasData.frames[g];
        plistContent += `<key>${frame.name}.png</key>\n`;
        plistContent += `<dict>\n`;
        plistContent +=     `<key>aliases</key>\n`;
        plistContent +=     `<array/>\n`;
        plistContent +=     `<key>spriteOffset</key>\n`;
        plistContent +=     `<string>${getSpriteOffset(frame)}</string>\n`;
        plistContent +=     `<key>spriteSize</key>\n`;
        plistContent +=     `<string>{${frame.size.width},${frame.size.height}}</string>\n`;
        plistContent +=     `<key>spriteSourceSize</key>\n`;
        plistContent +=     `<string>{${frame.orig.width},${frame.orig.height}}</string>\n`;
        plistContent +=     `<key>textureRect</key>\n`;
        plistContent +=     `<string>{{${frame.xy.x},${frame.xy.y}},{${frame.size.width},${frame.size.height}}}</string>\n`;
        plistContent +=     `<key>textureRotated</key>\n`;
        plistContent +=     `<${frame.rotate ? 'true' : 'false'}/>\n`;
        plistContent += `</dict>\n`;
    }
    plistContent += `</dict>\n`;
    return plistContent;
}

function generate(atlasData: IAtlasData) {
    let content = generatePlistFrames(atlasData) + generatePlistMeta(atlasData);
    return generatePlist(content);
}

function traverseDirSync(dir: string, handler: (dir: string, filePath: string) => void) {
    const files = readdirSync(dir);
    for (const file of files) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        if (stat.isDirectory()) {
            traverseDirSync(filePath, handler);
        } else {
            handler(dir, filePath);
        }
    }
}

const atlasPath = argv[2];
const isDir = atlasPath.indexOf('.atlas') < 0;
if (isDir) {
    traverseDirSync(atlasPath, (dir, filePath) => {
        if (extname(filePath) === '.atlas') {
            const atlasContent = readFileSync(filePath, 'utf-8');
            const data = parseAtlas(atlasContent);
            if (data) {
                const plist = generate(data);
                writeFileSync(join(dirname(filePath), `${data.name.replace('.png', '')}.plist`), plist, 'utf-8');
            }
        }
    })
} else {
    const atlasContent = readFileSync(atlasPath, 'utf-8');
    const data = parseAtlas(atlasContent);
    if (data) {
        const plist = generate(data);
        writeFileSync(join(dirname(atlasPath), `${data.name.replace('.png', '')}.plist`), plist, 'utf-8');
    }
}
