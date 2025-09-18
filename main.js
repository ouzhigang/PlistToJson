const fs = require('fs');

/**
 * 从Plist文本中提取所有帧数据
 * @param {string} xmlText - Plist文件的原始文本内容
 * @returns {object} 帧数据集合（key:帧名，value:帧详细信息）
 */
function extractFramesFromXmlText(xmlText) {
    const frames = {};
    // 优化正则：仅匹配.png文件名，排除前后的XML标签
    // 使用更严格的匹配模式，确保只捕获帧名本身
    const frameRegex = /<key>([^<]+?\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
    let match;

    while ((match = frameRegex.exec(xmlText)) !== null) {
        // 清除帧名中可能包含的空白字符
        const frameName = match[1].trim();
        const frameDictText = match[2];

        // 提取单个帧的指定属性
        const extractValue = (key) => {
            const valRegex = new RegExp(`<key>${key}</key>\\s*<string>([\\s\\S]*?)</string>`, 'i');
            const valMatch = frameDictText.match(valRegex);
            return valMatch ? valMatch[1].trim() : '';
        };

        frames[frameName] = {
            textureRect: extractValue('textureRect'),
            spriteSourceSize: extractValue('spriteSourceSize'),
            spriteOffset: extractValue('spriteOffset'),
            spriteTrimmed: frameDictText.includes('<key>spriteTrimmed</key>\\s*<true/>'),
            textureRotated: frameDictText.includes('<key>textureRotated</key>\\s*<true/>')
        };
    }

    return frames;
}

/**
 * 从Plist文本中提取图集元数据（尺寸、图片名、版本等）
 * @param {string} xmlText - Plist文件的原始文本内容
 * @returns {object} 图集元数据
 */
function extractMetadataFromXmlText(xmlText) {
    const metadata = {
        size: '{2048, 2048}', // 默认图集尺寸（常见值）
        version: '1.5.5',     // 默认版本
        textureFileName: 'atlas' // 默认图片名
    };

    // 提取图集尺寸
    const sizeMatch = xmlText.match(/<key>size<\/key>\s*<string>(\{[\d,\s]+\})<\/string>/i);
    if (sizeMatch) metadata.size = sizeMatch[1];

    // 提取版本号
    const versionMatch = xmlText.match(/<key>version<\/key>\s*<string>([\d.]+)<\/string>/i);
    if (versionMatch) metadata.version = versionMatch[1];

    // 提取纹理图片名（从target节点）
    const targetMatch = xmlText.match(/<key>target<\/key>\s*<dict>([\s\S]*?)<\/dict>/i);
    if (targetMatch) {
        const tfMatch = targetMatch[1].match(/<key>textureFileName<\/key>\s*<string>([\s\S]*?)<\/string>/i);
        if (tfMatch) metadata.textureFileName = tfMatch[1].trim();
    }

    return metadata;
}

/**
 * 主转换函数：Plist -> PixiJS 图集JSON
 * @param {string} plistPath - Plist文件路径（如./Fishtales.plist）
 * @param {string} outputJsonPath - 输出JSON路径（默认./atlas-pixi.json）
 */
async function convertPlistToPixi(plistPath, outputJsonPath = './atlas-pixi.json') {
    try {
        // 1. 读取Plist文件
        console.log(`📂 正在读取文件：${plistPath}`);
        if (!fs.existsSync(plistPath)) throw new Error(`文件不存在，请检查路径：${plistPath}`);
        const plistText = fs.readFileSync(plistPath, 'utf8').replace(/\r\n/g, '\n');

        // 2. 提取帧数据和元数据
        console.log(`🔍 正在从文本中提取帧数据...`);
        const frames = extractFramesFromXmlText(plistText);
        const metadata = extractMetadataFromXmlText(plistText);

        if (Object.keys(frames).length === 0) throw new Error(`未提取到任何帧数据，可能Plist格式错误`);
        console.log(`✅ 提取成功：共 ${Object.keys(frames).length} 个帧`);

        // 3. 解析数据并转换为Pixi格式
        const sizeMatch = metadata.size.match(/\{(\d+),\s*(\d+)\}/);
        const atlasSize = sizeMatch ? { w: parseInt(sizeMatch[1]), h: parseInt(sizeMatch[2]) } : { w: 2048, h: 2048 };
        const pixiFrames = {};

        Object.keys(frames).forEach(frameName => {
            const frame = frames[frameName];

            // 跳过关键数据缺失的帧
            if (!frame.textureRect || !frame.spriteSourceSize || !frame.spriteOffset) {
                console.warn(`⚠️  跳过帧 ${frameName}（关键数据缺失）`);
                return;
            }

            // 解析帧的位置、尺寸、偏移
            const rectMatch = frame.textureRect.match(/\{\{(\d+),\s*(\d+)\},\s*\{\s*(\d+),\s*(\d+)\}\}/);
            const sourceSizeMatch = frame.spriteSourceSize.match(/\{(\d+),\s*(\d+)\}/);
            const offsetMatch = frame.spriteOffset.match(/\{(-?\d+),\s*(-?\d+)\}/);

            // 跳过格式错误的帧
            if (!rectMatch || !sourceSizeMatch || !offsetMatch) {
                console.warn(`⚠️  跳过帧 ${frameName}（格式错误：${frame.textureRect}）`);
                return;
            }

            // 构建Pixi标准帧格式
            pixiFrames[frameName] = {
                frame: { x: parseInt(rectMatch[1]), y: parseInt(rectMatch[2]), w: parseInt(rectMatch[3]), h: parseInt(rectMatch[4]) },
                sourceSize: { w: parseInt(sourceSizeMatch[1]), h: parseInt(sourceSizeMatch[2]) },
                spriteSourceSize: { x: parseInt(offsetMatch[1]), y: parseInt(offsetMatch[2]), w: parseInt(sourceSizeMatch[1]), h: parseInt(sourceSizeMatch[2]) },
                rotated: frame.textureRotated,
                trimmed: frame.spriteTrimmed
            };

            console.log(`✅ 解析成功：${frameName}（${rectMatch[3]}x${rectMatch[4]}）`);
        });

        if (Object.keys(pixiFrames).length === 0) throw new Error(`未解析到有效帧，所有帧数据格式错误`);

        // 4. 生成并写入JSON文件
        const pixiAtlasJson = {
            frames: pixiFrames,
            meta: {
                image: `${metadata.textureFileName}.png`,
                format: 'RGBA8888',
                size: atlasSize,
                scale: '1',
                version: metadata.version
            }
        };

        fs.writeFileSync(outputJsonPath, JSON.stringify(pixiAtlasJson, null, 2), 'utf8');
        console.log(`\n🎉 转换完成！`);
        console.log(`- 输出JSON：${outputJsonPath}`);
        console.log(`- 有效帧：${Object.keys(pixiFrames).length} 个`);
        console.log(`- 图集图片：${metadata.textureFileName}.png（${atlasSize.w}x${atlasSize.h}）`);

    } catch (err) {
        console.error(`\n❌ 转换失败：${err.message}`);
    }
}

//=========================================================================================================================

const args = process.argv.splice(2);
if (args.length == 0) {
    console.log('需要传入plist文件路径');
    process.exit(0);
}

const plist = args[0];

//替换后缀名
const regex = new RegExp('\.plist(?=[^\.plist]*$)');
const json = plist.replace(regex, '-pixi.json');

// 执行转换（请确保Plist路径正确）
// 用法：convertPlistToPixi('你的Plist路径', '输出JSON路径')
convertPlistToPixi(plist, json);
