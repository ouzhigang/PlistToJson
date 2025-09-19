const plist = require('plist');
const fs = require('fs');
const path = require('path');

// 解析plist并转换为PixiJS Spritesheet格式
function convertPlistToPixiSpritesheet(plistFilePath, outputJsonPath) {
    try {
        // 读取并解析plist文件
        const xmlContent = fs.readFileSync(plistFilePath, 'utf8');
        const plistData = plist.parse(xmlContent);
        
        // 解析坐标字符串
        function parsePoint(str) {
            const [x, y] = str.replace(/[{}]/g, '').split(',').map(Number);
            return { x, y };
        }
        
        function parseRectangle(str) {
            const parts = str.replace(/[{}]/g, '').split(',').map(Number);
            return {
                x: parts[0],
                y: parts[1],
                width: parts[2],
                height: parts[3]
            };
        }
        
        // 获取纹理图片名称（从metadata中提取）
        const textureName = plistData.metadata.target.textureFileName + 
                          plistData.metadata.target.textureFileExtension;
        
        // 构建PixiJS Spritesheet结构
        const pixiSpritesheet = {
            frames: {},
            meta: {
                app: "PixiJS",
                version: "1.0.0",
                image: textureName,
                format: "RGBA8888",
                size: parsePoint(plistData.metadata.size),
                scale: "1"
            }
        };
        
        // 转换每个frame
        for (const [frameKey, frameData] of Object.entries(plistData.frames)) {
            const textureRect = parseRectangle(frameData.textureRect);
            const spriteSize = parsePoint(frameData.spriteSize);
            const spriteOffset = parsePoint(frameData.spriteOffset);
            
            pixiSpritesheet.frames[frameKey] = {
                frame: {
                    x: textureRect.x,
                    y: textureRect.y,
                    w: textureRect.width,
                    h: textureRect.height
                },
                sourceSize: {
                    w: spriteSize.x,
                    h: spriteSize.y
                },
                spriteSourceSize: {
                    x: spriteOffset.x,
                    y: spriteOffset.y,
                    w: spriteSize.x,
                    h: spriteSize.y
                },
                rotated: frameData.textureRotated,
                trimmed: frameData.spriteTrimmed
            };
        }
        
        // 保存为JSON文件
        fs.writeFileSync(
            outputJsonPath,
            JSON.stringify(pixiSpritesheet, null, 2),
            'utf8'
        );
        
        console.log(`成功转换为PixiJS Spritesheet: ${outputJsonPath}`);
        return pixiSpritesheet;
        
    } catch (error) {
        console.error('转换过程出错:', error);
        throw error;
    }
}

//=========================================================================================================================

const args = process.argv.splice(2);
if (args.length == 0) {
    console.log('需要传入plist文件路径');
    process.exit(0);
}

const plistfile = args[0];

//替换后缀名
const regex = new RegExp('\.plist(?=[^\.plist]*$)');
const jsonfile = plistfile.replace(regex, '-pixijs.json');

// 执行转换（请确保Plist路径正确）
// convertPlistToPixiSpritesheet('你的Plist路径', '输出JSON路径')
convertPlistToPixiSpritesheet(plistfile, jsonfile);
