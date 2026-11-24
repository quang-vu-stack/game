# Móng Việt 3D

Game web mô phỏng điều hành một công ty cổ phần xây dựng. Bản đầu có văn phòng 3D, hợp đồng xây nhà hai tầng và bảng theo dõi công trường dùng chung trạng thái.

## Chạy trên máy

Cần Node.js 22.13 trở lên.

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite in ra. Kéo chuột để xoay cảnh và cuộn để thu phóng. Nhận hợp đồng, duyệt dự toán, mua vật tư và giao việc. Nút **Qua ngày** cho đội thi công tiến thêm một ngày. Mỗi ngày thi công dùng một lô vật tư. Khi đạt 100%, nghiệm thu để nhận thanh toán. Game lưu tiến độ trên trình duyệt hiện tại.

```sh
npm test
npm run build
```

## Tích hợp cảnh công trường

Issue #2 phụ trách `src/site/`. Cảnh xuất hàm có tên `mountSite` từ `src/site/index.ts`. Dùng các kiểu trong `src/simulation/contracts.ts`. Hàm nhận phần tử chứa cảnh và callback `onReport`, rồi trả về `update(snapshot)` và `dispose()`. Ứng dụng gửi trạng thái hiện tại ngay sau khi mở cảnh và sau mỗi thao tác. Cảnh đọc trạng thái để cập nhật hình ảnh, dùng callback để gửi báo cáo về văn phòng và dọn canvas, listener, bộ hẹn giờ khi đóng. Khi chưa có module, nút **Công trường** mở bảng theo dõi dự án.
