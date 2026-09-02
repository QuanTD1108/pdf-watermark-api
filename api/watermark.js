// Cài đặt thư viện: npm install pdf-lib axios
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const axios = require('axios');

module.exports = async (req, res) => {
    // Chỉ nhận request POST từ Make.com
    if (req.method !== 'POST') return res.status(405).send('Only POST method allowed');

    try {
        // Nhận Link file gốc và Tên khách hàng từ Make.com gửi sang
        const { fileUrl, name } = req.body;

        // Tải file PDF gốc dưới dạng Buffer
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const pdfDoc = await PDFDocument.load(response.data);
        const pages = pdfDoc.getPages();
        
        const watermarkText = `EXCLUSIVELY FOR: ${name}`;

        // Lặp qua từng trang (i bắt đầu từ 0)
        for (let i = 0; i < pages.length; i++) {
            // (i + 1) là số thứ tự trang. Chỉ đóng dấu trang chẵn
            if ((i + 1) % 2 === 0) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Đóng dấu chữ mờ, nghiêng 45 độ, căn giữa trang
                page.drawText(watermarkText, {
                    x: width / 2 - 200, 
                    y: height / 2 - 50,
                    size: 35,
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
        res.status(500).send({ error: error.message });
    }
};
