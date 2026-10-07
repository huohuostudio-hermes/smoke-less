import AppKit
import Foundation

// 用法: swift render_emoji.swift <输出.png> <像素> <字号比例>
let args = CommandLine.arguments
let outPath = args.count > 1 ? args[1] : "emoji.png"
let px = args.count > 2 ? Int(args[2]) ?? 512 : 512
let scale = args.count > 3 ? Double(args[3]) ?? 0.72 : 0.72

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px,
                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                           isPlanar: false, colorSpaceName: .deviceRGB,
                           bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: px, height: px)

NSGraphicsContext.saveGraphicsState()
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
ctx.imageInterpolation = .high

// 透明背景
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: px, height: px).fill()

let fontSize = CGFloat(Double(px) * scale)
let font = NSFont.systemFont(ofSize: fontSize)
let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.white]
let str = NSAttributedString(string: "🚬", attributes: attrs)
let strSize = str.size()
let x = (CGFloat(px) - strSize.width) / 2
let y = (CGFloat(px) - strSize.height) / 2
str.draw(at: NSPoint(x: x, y: y))

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    print("ERROR: png encode failed")
    exit(1)
}
try! png.write(to: URL(fileURLWithPath: outPath))
print("OK", outPath, "\(px)x\(px)")
