const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');
const axios = require('axios');
 
// Chuyển "Nguyễn Văn A" -> "Nguyen Van A" để font chuẩn (không hỗ trợ Unicode
// tiếng Việt) vẫn render được bình thường, không cần nhúng font riêng.
function removeVietnameseTones(str) {
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    str = str.replace(/đ/g, 'd').replace(/Đ/g, 'D');
    return str;
}
 
module.exports = async (req, res) => {
    // Chỉ nhận request POST từ Make.com
    if (req.method !== 'POST') {
        return res.status(405).send('Only POST method allowed');
    }
 
    try {
        // Nhận Link file gốc và Tên khách hàng từ Make.com gửi sang
        const { fileUrl, name } = req.body;
 
        // Validate input đầu vào
        if (!fileUrl || typeof fileUrl !== 'string') {
            return res.status(400).send({ error: 'Thiếu hoặc sai định dạng "fileUrl"' });
        }
        if (!name || typeof name !== 'string') {
            return res.status(400).send({ error: 'Thiếu hoặc sai định dạng "name"' });
        }
 
        // Tải file PDF gốc dưới dạng Buffer (có timeout để tránh treo function)
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 15000, // 15 giây
            maxContentLength: 50 * 1024 * 1024, // giới hạn 50MB
        });
 
        const pdfDoc = await PDFDocument.load(response.data);
 
        // Dùng font chuẩn Helvetica có sẵn trong pdf-lib, không cần font ngoài
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
 
        const pages = pdfDoc.getPages();
 
        // Bỏ dấu tiếng Việt trong tên trước khi ghép vào watermark
        const safeName = removeVietnameseTones(name);
        const watermarkText = `EXCLUSIVELY FOR: ${safeName}`;
        const fontSize = 35;
 
        // Tính độ rộng thực tế của watermark để căn giữa chính xác
        const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
 
        // Lặp qua từng trang (i bắt đầu từ 0)
        for (let i = 0; i < pages.length; i++) {
            // (i + 1) là số thứ tự trang. Chỉ đóng dấu trang chẵn
            if ((i + 1) % 2 === 0) {
                const page = pages[i];
                const { width, height } = page.getSize();
 
                // Đóng dấu chữ mờ, nghiêng 45 độ, căn giữa trang
                page.drawText(watermarkText, {
                    x: width / 2 - textWidth / 2,
                    y: height / 2 - fontSize / 2,
                    size: fontSize,
                    font,
                    color: rgb(0.5, 0.5, 0.5), // Màu xám (0.5)
                    opacity: 0.15,             // Độ trong suốt 15%
                    rotate: degrees(45),
                });
            }
        }
 
        // Lưu file PDF đã đóng dấu
        const pdfBytes = await pdfDoc.save();
 
        // Trả file thẳng về cho Make.com để gửi Mail
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Watermark PDF error:', error);
        res.status(500).send({ error: error.message });
    }
};
