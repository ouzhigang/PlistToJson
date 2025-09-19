const plist = require('plist');
const fs = require('fs');
const path = require('path');

// 解析plist并转换为Phaser Atlas格式
function convertPlistToPhaserAtlas(plistFilePath, outputJsonPath) {
    try {
        // 读取并解析plist文件
        const xmlContent = fs.readFileSync(plistFilePath, 'utf8');
        const plistData = plist.parse(xmlContent);
        
        // 解析坐标字符串的工具函数
        function parseRectangle(str) {
            const parts = str.replace(/[{}]/g, '').split(',').map(Number);
            return {
                x: parts[0],
                y: parts[1],
                width: parts[2],
                height: parts[3]
            };
        }
        
        function parsePoint(str) {
            const [x, y] = str.replace(/[{}]/g, '').split(',').map(Number);
            return { x, y };
        }
        
        // 获取纹理图片名称（从metadata中提取）
        const textureName = plistData.metadata.target.textureFileName + 
                          plistData.metadata.target.textureFileExtension;
        
        // 构建Phaser Atlas结构
        const phaserAtlas = {
            frames: {},
            meta: {
                image: textureName,
                format: "RGBA8888",
                size: {
                    w: parsePoint(plistData.metadata.size).x,
                    h: parsePoint(plistData.metadata.size).y
                },
                scale: 1
            }
        };
        
        // 转换每个frame到Phaser格式
        for (const [frameKey, frameData] of Object.entries(plistData.frames)) {
            const textureRect = parseRectangle(frameData.textureRect);
            const spriteSize = parsePoint(frameData.spriteSize);
            const spriteOffset = parsePoint(frameData.spriteOffset);
            const spriteSourceSize = parsePoint(frameData.spriteSourceSize);
            
            // Phaser的frame格式
            phaserAtlas.frames[frameKey] = {
                // 纹理在图集上的位置和大小
                frame: {
                    x: textureRect.x,
                    y: textureRect.y,
                    w: textureRect.width,
                    h: textureRect.height
                },
                // 源图像的大小
                sourceSize: {
                    w: spriteSourceSize.x,
                    h: spriteSourceSize.y
                },
                spriteSourceSize: {
                    x: 0,
                    y: 0,
                    w: spriteSourceSize.x,
                    h: spriteSourceSize.y
                },
                // 裁剪偏移（如果有）
                offset: {
                    x: spriteOffset.x,
                    y: spriteOffset.y
                },
                // 是否旋转
                rotated: frameData.textureRotated,
                // 是否裁剪
                trimmed: frameData.spriteTrimmed
            };
        }
        
        // 保存为JSON文件
        fs.writeFileSync(
            outputJsonPath,
            JSON.stringify(phaserAtlas, null, 2),
            'utf8'
        );
        
        console.log(`成功转换为Phaser Atlas: ${outputJsonPath}`);
        return phaserAtlas;
        
    } catch (error) {
        console.error('转换过程出错:', error);
        throw error;
    }
}



const args = process.argv.splice(2);
if (args.length == 0) {
    console.log('需要传入plist文件路径');
    process.exit(0);
}

const plistfile = args[0];

//替换后缀名
const regex = new RegExp('\.plist(?=[^\.plist]*$)');
const jsonfile = plistfile.replace(regex, '-phaser.json');

// 执行转换
convertPlistToPhaserAtlas(plistfile, jsonfile);
