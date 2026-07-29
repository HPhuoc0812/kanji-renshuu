# Luồng Project Kanji Renshuu

## 1. Tổng quan

Kanji Renshuu là một web app tĩnh/PWA dùng để luyện Kanji bằng dữ liệu từ Excel, CSV hoặc Google Sheets.

Project gồm các file chính:

- `index.html`: dựng giao diện chính.
- `assets/js/app.js`: entrypoint, bind event, khởi động app và đăng ký service worker.
- `assets/js/constants.js`: hằng số dùng chung.
- `assets/js/dom.js`: gom DOM references dùng chung cho các module.
- `assets/js/data.js`: load/cache/import/chuẩn hóa dữ liệu Kanji.
- `assets/js/quiz.js`: tạo quiz, render câu hỏi, chấm điểm và phím điều hướng đáp án.
- `assets/js/radicals.js`: load, lọc và render dữ liệu bộ thủ.
- `assets/js/ui.js`: theme, tab, error UI và helper UI nhỏ.
- `assets/js/utils.js`: helper chuẩn hóa text, random và shuffle.
- `assets/js/dictionary.js`: logic tra cứu từ điển Kanji, gọi Mazii API, popup chi tiết và tính năng thêm vào Sheets.
- `assets/js/whiteboard.js`: chức năng bảng vẽ Kanji (tích hợp trong quiz).
- `assets/js/kanji-guide.js`: vẽ hoạt ảnh hướng dẫn nét chữ Kanji.
- `assets/js/similar-kanji.js`: dữ liệu và logic tìm các chữ Kanji có hình dáng tương đồng.
- `assets/css/styles.css`: style giao diện.
- `assets/data/kanji-cache.json`: dữ liệu Kanji tĩnh đi kèm app để phòng trường hợp chưa có internet/cache runtime.
- `assets/data/radicals.json`: dữ liệu 214 bộ thủ Kanji/Kangxi.
- `libs/xlsx.full.min.js`: thư viện đọc file Excel.
- `sw.js`: service worker cho cache/offline.
- `manifest.webmanifest`: cấu hình PWA.
- `dev-server.mjs`: server local đơn giản để chạy app.

### 1.1. Nguyên tắc chia module

App vẫn là vanilla JavaScript, không dùng bundler/framework. Các file trong `assets/js` là ES modules và được browser load trực tiếp.

Ranh giới chính:

- `app.js` chỉ điều phối: import module, bind event, gọi init.
- `data.js` quản lý state Kanji và các nguồn dữ liệu.
- `quiz.js` quản lý state quiz riêng, không parse/import data.
- `radicals.js` quản lý riêng tab tra cứu bộ thủ.
- `ui.js` xử lý thao tác UI dùng chung.
- `dom.js` gom các selector tập trung để tránh lặp lại `document.getElementById(...)`.
- `constants.js` gồm các key/cache path/giới hạn.
- `utils.js` gồm helper thuần, không đụng DOM.

## 2. Luồng khởi động app

Khi mở `index.html`, trình duyệt load theo thứ tự:

1. CSS từ `assets/css/styles.css`.
2. Thư viện Excel `libs/xlsx.full.min.js`.
3. File module entrypoint `assets/js/app.js`.

`index.html` load entrypoint bằng:

```html
<script type="module" src="assets/js/app.js"></script>
```

Trong `assets/js/app.js`, khi sự kiện `DOMContentLoaded` chạy, app gọi:

```js
loadThemePreference();
setModeSelectValue(elements.modeSelect.value);
setActiveTab("practicePanel");
autoLoadDefaultUrl();
loadRadicalsData();
```

Ý nghĩa:

1. `loadThemePreference()` đọc theme sáng/tối từ `localStorage`. Nếu chưa có thì lấy theo theme của hệ thống.
2. `setModeSelectValue()` đồng bộ segmented control với select thật.
3. `setActiveTab("practicePanel")` đặt tab mặc định là tab luyện tập.
4. `autoLoadDefaultUrl()` ưu tiên tải dữ liệu Kanji đã cache, sau đó đọc `kanji-cache.json` nếu cần, rồi mới tự động cập nhật từ URL mặc định khi có mạng.
5. `loadRadicalsData()` tải file JSON 214 bộ thủ để phục vụ tab tra cứu.

Sau khi trang load xong, app đăng ký service worker:

```js
navigator.serviceWorker.register("./sw.js")
```

Nếu đăng ký service worker thất bại, app vẫn chạy bình thường, chỉ mất tính năng PWA/offline cache của app shell.

## 3. Cấu trúc giao diện

Giao diện trong `index.html` có 2 tab chính:

- Tab `Luyện tập`: gồm setup card và quiz area.
- Tab `Tra cứu bộ thủ`: gồm công cụ tìm kiếm/lọc và dữ liệu 214 bộ thủ.

Hai tab được điều khiển bằng:

- `practiceTabBtn`
- `radicalsTabBtn`
- `practicePanel`
- `radicalsPanel`

Hàm điều khiển:

```js
setActiveTab(panelId)
```

Hàm này:

1. Toggle class `hidden` trên các `.tab-panel`.
2. Cập nhật `aria-hidden` cho panel.
3. Cập nhật class `active` và `aria-selected` cho nút tab.

### 3.1. Practice tab

Đây là tab mặc định khi mở app, có 2 khu vực chính.

#### 3.1.1. Setup card

Đây là khu vực cấu hình trước khi bắt đầu luyện tập.

Bao gồm:

- Chọn file Excel/CSV: `fileInput`.
- Chọn chế độ luyện: `modeSelect`.
- Nhập số câu: `questionCount`.
- Nút chọn số câu tối đa: `maxQuestionBtn`.
- Lọc theo bài:
  - `lessonFrom`
  - `lessonTo`
- Nhập URL Excel/CSV/Google Sheets: `urlInput`.
- Nút import từ URL: `importBtn`.
- Nút bắt đầu luyện tập: `startBtn`.
- Vùng hiển thị trạng thái: `fileInfo`.
- Vùng hiển thị lỗi: `errorMessage`.

#### 3.1.2. Quiz area

Khu vực quiz ban đầu bị ẩn bằng class `hidden`.

Bao gồm:

- Trạng thái câu hỏi: `quizStatus`.
- Điểm hiện tại: `scoreInfo`.
- Nội dung câu hỏi: `questionPrompt`.
- Danh sách đáp án: `options`.
- Nút xác nhận: `confirmBtn`.
- Nút câu tiếp theo: `nextBtn`.
- Nút làm lại: `resetBtn`.

Khi người dùng bấm "Bắt đầu luyện tập", nếu tạo quiz thành công thì khu vực này mới hiện ra.

### 3.2. Radicals tab

Đây là tab tra cứu 214 bộ thủ.

Bao gồm:

- Vùng đếm kết quả: `radicalsCount`.
- Ô tìm kiếm: `radicalsSearch`.
- Bộ lọc số nét: `radicalsStrokeFilter`.
- Lưới hiển thị bộ thủ: `radicalsGrid`.
- Vùng thông báo: `radicalsMessage`.

Mỗi item bộ thủ hiện:

- Ký tự bộ thủ chính.
- Số thứ tự.
- Âm Hán Việt.
- Số nét.
- Nghĩa.
- Các dạng biến thể nếu có.

## 4. Luồng dữ liệu

App có 2 nhóm dữ liệu:

1. Dữ liệu Kanji để luyện tập.
2. Dữ liệu bộ thủ để tra cứu.

Dữ liệu Kanji có 4 nguồn:

1. Google Sheets / URL.
2. File local Excel hoặc CSV.
3. Dữ liệu đã lưu trong `localStorage`.
4. File tĩnh `assets/data/kanji-cache.json`.

Thứ tự ưu tiên khi app khởi động:

1. Đọc dữ liệu đã import/cập nhật trong `localStorage` bằng `loadKanjiDataFromStorage()`.
2. Nếu chưa có `localStorage`, đọc seed JSON `assets/data/kanji-cache.json` bằng `loadBundledKanjiData()`.
3. Nếu trình duyệt báo có mạng, gọi `parseRemoteUrl(defaultUrl)` để cập nhật dữ liệu mới từ URL mặc định.
4. Nếu URL cập nhật thành công, dữ liệu mới sẽ ghi vào `localStorage` bằng `saveKanjiDataToStorage()`.
5. Nếu cả JSON đi kèm cũng không đọc được, app mới dùng `fallbackData` tối thiểu trong code.

### 4.1. Dữ liệu từ Google Sheets / URL

Hàm chính:

```js
parseRemoteUrl(url)
```

Luồng xử lý:

1. Người dùng bấm `Import từ URL`, hoặc app tự động gọi `autoLoadDefaultUrl()` khi mở trang.
2. URL được đưa vào `parseRemoteUrl(url)`.
3. Nếu URL là Google Sheets, app gọi `normalizeGoogleSheetsUrl(url)` để đổi link edit thành link export CSV.
4. App dùng `fetchWithTimeout()` để tải dữ liệu, giới hạn thời gian cho request remote.
5. Nếu response là CSV, app đọc text và gọi `loadCsvText(text)`.
6. Nếu response là Excel, app đọc buffer và gọi `parseExcelBuffer(buffer)`.
7. Nếu không xác định được rõ kiểu file, app thử đọc như CSV.
8. Dữ liệu sau cùng được đưa vào `loadDataFromJson(json)`.

Nếu trình duyệt đang offline, app bỏ qua fetch remote và dùng dữ liệu offline. Nếu fetch thất bại hoặc timeout, app thử đọc dữ liệu đã cache trong `localStorage` bằng `loadKanjiDataFromStorage()`.

### 4.2. Dữ liệu từ file local

Event chính:

```js
fileInput.addEventListener("change", ...)
```

Luồng xử lý:

1. Người dùng chọn file.
2. App kiểm tra tên file.
3. Nếu file kết thúc bằng `.csv`, gọi `parseCsv(file)`.
4. Nếu file kết thúc bằng `.xlsx` hoặc `.xls`, gọi `parseExcel(file)`.
5. Nếu không đúng định dạng, hiện lỗi.

Với CSV:

1. `parseCsv(file)` đọc file bằng `FileReader`.
2. Sau khi đọc xong, gọi `loadCsvText(csv)`.
3. `loadCsvText()` tách header và các dòng dữ liệu.
4. Mỗi dòng CSV được map thành object JSON.
5. Gọi `loadDataFromJson(json)`.

Với Excel:

1. `parseExcel(file)` đọc file thành `ArrayBuffer`.
2. Gọi `parseExcelBuffer(buffer)`.
3. `parseExcelBuffer()` dùng thư viện `XLSX`.
4. Lấy sheet đầu tiên trong workbook.
5. Chuyển sheet thành JSON.
6. Gọi `loadDataFromJson(json)`.

### 4.3. Dữ liệu đã cache trong localStorage

Dữ liệu import thành công từ URL, Google Sheets, Excel hoặc CSV được lưu vào `localStorage`.

Key cache:

```js
kanji-renshuu-data-v1
```

Mỗi bản ghi cache gồm:

```js
{
  savedAt: "...",
  hasLessonInfo: true,
  data: [...]
}
```

Đây là lớp dữ liệu động của app. Browser có thể tự ghi/cập nhật lớp này khi app đang chạy.

### 4.4. Dữ liệu Kanji tĩnh đi kèm app

Dữ liệu Kanji tĩnh nằm trong:

```text
assets/data/kanji-cache.json
```

File này có vai trò như seed/fallback cho lần đầu mở app khi chưa có internet hoặc chưa từng import dữ liệu.

Dạng dữ liệu:

```js
{
  "version": 1,
  "hasLessonInfo": false,
  "items": [
    {
      "kanji": "...",
      "reading": "...",
      "lesson": 1
    }
  ]
}
```

Trong đó:

- `version`: version dữ liệu tĩnh.
- `hasLessonInfo`: cho biết seed có hỗ trợ cột bài hay không.
- `items`: danh sách Kanji dùng để luyện tập.

Nếu `lesson` không có trong item, app vẫn dùng được nhưng không lọc theo bài.

Hàm tải dữ liệu:

```js
loadBundledKanjiData()
```

Luồng xử lý:

1. Gọi `fetch("assets/data/kanji-cache.json")`.
2. Parse response thành JSON.
3. Kiểm tra `items` là array và không rỗng.
4. Gán dữ liệu vào `bundledKanjiData`.
5. Gọi `setKanjiData(...)` để app có dữ liệu luyện tập ngay cả khi chưa có internet.
6. Nếu đọc JSON thất bại, app dùng `fallbackData` tối thiểu trong code.

Lưu ý quan trọng:

- Browser/PWA không thể tự ghi ngược vào file `assets/data/kanji-cache.json`.
- Khi có internet, dữ liệu mới được cập nhật vào `localStorage`, không sửa file JSON tĩnh.
- Muốn cập nhật file JSON thật trong repo thì cần sửa file thủ công hoặc dùng script/build step bên ngoài browser.

### 4.5. Dữ liệu fallback

Nếu chưa có dữ liệu import và không đọc được `kanji-cache.json`, app dùng `fallbackData` tối thiểu trong `assets/js/app.js`.

Hàm chọn nguồn dữ liệu:

```js
function getSourceData() {
  return kanjiData.length ? kanjiData : bundledKanjiData;
}
```

Nghĩa là:

- Nếu `kanjiData` có dữ liệu, dùng dữ liệu đang active.
- Nếu `kanjiData` rỗng, dùng dữ liệu tĩnh/fallback trong `bundledKanjiData`.

### 4.6. Dữ liệu 214 bộ thủ

Dữ liệu bộ thủ nằm trong:

```text
assets/data/radicals.json
```

Mỗi item có dạng:

```js
{
  id: 1,
  radical: "一",
  variants: [],
  strokes: 1,
  hanViet: "nhất",
  meaning: "một"
}
```

Trong đó:

- `id`: số thứ tự bộ thủ.
- `radical`: ký tự bộ thủ chính.
- `variants`: các dạng biến thể.
- `strokes`: số nét.
- `hanViet`: âm Hán Việt.
- `meaning`: nghĩa tiếng Việt.

Hàm tải dữ liệu:

```js
loadRadicalsData()
```

Luồng xử lý:

1. Gọi `fetch("assets/data/radicals.json")`.
2. Parse response thành JSON.
3. Kiểm tra dữ liệu là array và không rỗng.
4. Gán vào biến `radicalsData`.
5. Gọi `populateRadicalStrokeFilter()` để tạo danh sách số nét.
6. Gọi `renderRadicals()` để hiển thị danh sách ban đầu.

Nếu tải thất bại, app cập nhật `radicalsCount` và `radicalsMessage` để báo lỗi.

## 5. Chuẩn hóa dữ liệu

Hàm quan trọng:

```js
loadDataFromJson(json)
```

Hàm này tìm các cột cần thiết trong file.

Cột Kanji có thể có tên:

- `Kanji`
- `kanji`
- `漢字`
- `kanji `
- `B`

Cột âm Hán / reading có thể có tên:

- `Âm Hán`
- `ÂmHán`
- `reading`
- `Hán`
- `âm hán`
- `am han`
- `C`

Cột bài / lesson có thể có tên:

- `Bài`
- `bài`
- `Bai`
- `lesson`
- `Lesson`
- `A`

Sau khi tìm được cột, mỗi dòng dữ liệu được chuẩn hóa thành:

```js
{
  kanji: "...",
  reading: "...",
  lesson: 1
}
```

Trong đó:

- `kanji`: chữ Kanji.
- `reading`: âm Hán.
- `lesson`: số bài, nếu không có thì là `null`.

Những dòng thiếu Kanji hoặc reading sẽ bị loại.

Nếu dữ liệu hợp lệ, app gọi:

```js
setKanjiData(data, Boolean(lessonKey));
saveKanjiDataToStorage();
```

Kết quả:

- Dữ liệu được lưu vào biến `kanjiData`.
- Trạng thái có/không có cột bài được lưu vào `hasLessonInfo`.
- Dữ liệu được cache vào `localStorage`.

Key cache:

```js
kanji-renshuu-data-v1
```

## 6. Luồng tạo quiz

Khi người dùng bấm nút "Bắt đầu luyện tập", event của `startBtn` chạy.

Luồng xử lý:

1. Nếu chưa có `kanjiData`, app báo đang dùng dữ liệu mẫu.
2. Gọi `buildQuiz()`.
3. Nếu `buildQuiz()` trả về `false`, dừng lại và hiện lỗi.
4. Nếu thành công, gọi `showQuizArea()`.

Hàm tạo quiz:

```js
buildQuiz()
```

Bên trong `buildQuiz()`:

1. Lấy số câu từ input `questionCount`.
2. Giới hạn số câu trong khoảng hợp lệ, tối đa `MAX_QUESTION_COUNT = 300`.
3. Gọi `getFilteredSourceData()` để lấy dữ liệu đã lọc theo bài.
4. Kiểm tra lỗi lọc bài.
5. Kiểm tra có đủ item để tạo quiz không.
6. Shuffle danh sách câu hỏi.
7. Lấy đúng số câu cần luyện.
8. Reset trạng thái quiz:
   - `score = 0`
   - `currentIndex = 0`
   - `selectedChoice = null`
   - `selectedButton = null`

## 7. Luồng lọc theo bài

Hàm chính:

```js
getFilteredSourceData()
```

Luồng xử lý:

1. Lấy source data bằng `getSourceData()`.
2. Đọc giá trị `lessonFrom` và `lessonTo`.
3. Xác định người dùng có nhập "Từ bài" hoặc "Đến bài" không.
4. Nếu có lọc theo bài nhưng dữ liệu không có cột bài, trả về lỗi.
5. Nếu `from > to`, trả về lỗi.
6. Nếu không nhập phạm vi bài, trả về toàn bộ source data.
7. Nếu có nhập phạm vi, chỉ giữ item có `lesson` nằm trong khoảng.

Kết quả trả về dạng:

```js
{
  data: [...],
  error: ""
}
```

Nếu có lỗi:

```js
{
  data: [],
  error: "..."
}
```

## 8. Luồng hiển thị câu hỏi

Sau khi quiz được tạo, app gọi:

```js
showQuizArea()
```

Hàm này:

1. Gọi `setActiveTab("practicePanel")` để đảm bảo đang ở tab luyện tập.
2. Gỡ class `hidden` khỏi `quizArea`.
3. Gọi `renderQuestion()`.
4. Scroll đến khu vực quiz.

Hàm hiển thị câu hỏi:

```js
renderQuestion()
```

Nếu đã hết câu:

1. Hiện text hoàn thành.
2. Xóa danh sách đáp án.
3. Hiện tổng số câu đã làm.
4. Hiện điểm cuối.
5. Ẩn nút xác nhận và nút câu tiếp theo.

Nếu vẫn còn câu:

1. Lấy item hiện tại từ `quizItems[currentIndex]`.
2. Lấy chế độ hiện tại từ `modeSelect.value`.
3. Lấy source data bằng `getSourceData()`.
4. Tạo danh sách đáp án bằng `buildChoices(item, source, mode)`.
5. Shuffle đáp án.
6. Xóa đáp án cũ trong `optionsContainer`.
7. Render từng đáp án thành button.
8. Cập nhật câu hỏi theo mode:
   - `reading-to-kanji`: nhìn âm Hán, chọn Kanji.
   - `kanji-to-reading`: nhìn Kanji, chọn âm Hán.
9. Cập nhật trạng thái câu hỏi và điểm.
10. Hiện nút `Xác nhận`.
11. Ẩn nút `Câu tiếp theo`.

## 9. Luồng tạo đáp án

Hàm chính:

```js
buildChoices(item, source, mode)
```

Mục tiêu: tạo tối đa 4 lựa chọn, trong đó có 1 đáp án đúng.

Luồng xử lý:

1. Đưa item đúng vào danh sách `choices`.
2. Tạo `usedDisplayValues` để tránh trùng giá trị hiển thị.
3. Lọc danh sách ứng viên sai:
   - Loại item trùng cả Kanji và reading với câu hiện tại.
   - Loại item có reading trùng sau khi normalize.
   - Loại item có giá trị hiển thị đã được dùng.
4. Shuffle ứng viên sai.
5. Thêm ứng viên vào `choices` cho đến khi đủ 4 đáp án.
6. Trả về danh sách đáp án.

Số đáp án tối đa:

```js
MAX_OPTION_COUNT = 4
```

## 10. Luồng chọn đáp án

Khi người dùng bấm vào một đáp án, app gọi:

```js
selectAnswer(choice, button)
```

Hàm này:

1. Nếu trước đó đã chọn đáp án khác, gỡ class `selected` khỏi button cũ.
2. Gán `selectedChoice = choice`.
3. Gán `selectedButton = button`.
4. Thêm class `selected` vào button mới.

Tại thời điểm này app chưa chấm điểm. Chấm điểm chỉ xảy ra khi bấm `Xác nhận`.

## 11. Luồng xác nhận đáp án

Khi người dùng bấm `Xác nhận`, app gọi:

```js
confirmAnswer()
```

Luồng xử lý:

1. Nếu chưa chọn đáp án, hiện lỗi.
2. Lấy item hiện tại từ `quizItems[currentIndex]`.
3. So sánh đáp án đã chọn với đáp án đúng:

```js
selectedChoice.kanji === item.kanji &&
selectedChoice.reading === item.reading
```

4. Nếu đúng:
   - Tăng `score`.
   - Button được thêm class `correct`.
5. Nếu sai:
   - Button đã chọn được thêm class `wrong`.
   - Đáp án đúng được thêm class `correct`.
6. Disable tất cả option.
7. Cập nhật điểm.
8. Ẩn nút `Xác nhận`.
9. Hiện nút `Câu tiếp theo`.

## 12. Luồng câu tiếp theo và kết thúc quiz

Khi người dùng bấm `Câu tiếp theo`, app chạy:

```js
currentIndex += 1;
renderQuestion();
```

Nếu `currentIndex` vẫn nhỏ hơn tổng số câu, app hiện câu tiếp theo.

Nếu `currentIndex >= quizItems.length`, `renderQuestion()` hiện màn hình hoàn thành và điểm cuối:

```js
score / quizItems.length
```

## 13. Luồng làm lại

Khi bấm nút `Làm lại`, app chạy:

```js
resetBtn.addEventListener("click", ...)
```

Luồng xử lý:

1. Ẩn `quizArea`.
2. Xóa `kanjiData`.
3. Xóa `quizItems`.
4. Reset `currentIndex = 0`.
5. Reset `score = 0`.
6. Cập nhật `fileInfo`.
7. Ẩn lỗi.
8. Gọi `autoLoadDefaultUrl()` để tải lại dữ liệu từ URL/cache.

Lưu ý: nút `Làm lại` hiện tại không chỉ reset bài quiz, mà còn reset cả dữ liệu đang dùng rồi tải lại từ URL mặc định.

## 14. Luồng dark mode

App dùng key:

```js
kanji-renshuu-theme
```

Các hàm liên quan:

- `loadThemePreference()`
- `applyTheme(theme)`
- `toggleTheme()`

Luồng xử lý:

1. Khi mở app, đọc theme đã lưu trong `localStorage`.
2. Nếu không có, dùng `prefers-color-scheme`.
3. Khi bấm nút theme, app đổi giữa `light` và `dark`.
4. Theme mới được lưu lại vào `localStorage`.
5. Body được toggle class `dark-mode`.

## 15. Luồng segmented mode control

App có select thật:

```html
<select id="modeSelect">
```

Select thật được ẩn bằng class `native-select`, còn UI người dùng thấy là segmented control gồm 2 nút:

- `Âm Hán -> Kanji`
- `Kanji -> Âm Hán`

Các hàm liên quan:

- `setModeSelectValue(value)`

Khi bấm một mode segment:

1. Cập nhật `modeSelect.value`.
2. Cập nhật class `active` trên các nút segment.
3. Cập nhật `aria-pressed` để phản ánh trạng thái đang chọn.
4. Quiz đọc mode hiện tại từ `modeSelect.value`.

## 16. Phím tắt

Hàm xử lý phím tắt:

```js
handleKeyboardShortcut(event)
```

Các phím tắt:

- `Enter` khi quiz đang ẩn: bắt đầu luyện tập.
- `R`: làm lại.
- `M`: đặt số câu bằng max theo dữ liệu hiện tại.
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`: di chuyển/chọn option.
- `Enter` trong quiz:
  - Nếu nút `Câu tiếp theo` đang hiện, chuyển sang câu tiếp theo.
  - Nếu nút `Xác nhận` đang hiện, xác nhận đáp án.
  - Nếu chưa chọn đáp án, app tự chọn option đầu tiên rồi xác nhận.

Hàm `isTypingTarget()` giúp bỏ qua phím tắt khi người dùng đang gõ trong input/select/textarea.

Lưu ý với tab:

- Phím tắt quiz chỉ hoạt động khi `practicePanel` đang hiện.
- Khi đang ở tab `Tra cứu bộ thủ`, `handleKeyboardShortcut()` return sớm để tránh bấm Enter/R/M làm ảnh hưởng quiz.

## 17. Luồng tra cứu bộ thủ

Dữ liệu bộ thủ được load một lần khi `DOMContentLoaded`.

Các hàm liên quan:

- `loadRadicalsData()`
- `populateRadicalStrokeFilter()`
- `getFilteredRadicals()`
- `renderRadicals()`
- `normalizeSearchText(value)`
- `getRadicalSearchText(item)`

### 17.1. Tạo bộ lọc số nét

Hàm:

```js
populateRadicalStrokeFilter()
```

Luồng xử lý:

1. Lấy tất cả `strokes` từ `radicalsData`.
2. Dùng `Set` để loại trùng.
3. Sắp xếp tăng dần.
4. Thêm các option vào `radicalsStrokeFilter`.

### 17.2. Tìm kiếm và lọc

Hàm:

```js
getFilteredRadicals()
```

Luồng xử lý:

1. Đọc query từ `radicalsSearch`.
2. Normalize query bằng `normalizeSearchText()`:
   - Trim text.
   - Tách dấu tiếng Việt bằng `NFD`.
   - Loại combining marks.
   - Chuyển về lowercase.
3. Đọc số nét từ `radicalsStrokeFilter`.
4. Lọc theo số nét nếu người dùng có chọn.
5. Nếu có query, so khớp với chuỗi gồm:
   - `id`
   - `radical`
   - `hanViet`
   - `meaning`
   - `strokes`
   - `variants`

### 17.3. Render danh sách bộ thủ

Hàm:

```js
renderRadicals()
```

Luồng xử lý:

1. Gọi `getFilteredRadicals()`.
2. Xóa nội dung cũ trong `radicalsGrid`.
3. Cập nhật `radicalsCount` theo dạng `x / 214 bộ`.
4. Nếu không có kết quả, hiện thông báo trong `radicalsMessage`.
5. Nếu có kết quả, render mỗi item thành `article.radical-item`.

### 17.4. Event của tab tra cứu

```js
radicalsSearchInput.addEventListener("input", renderRadicals);
radicalsStrokeFilter.addEventListener("change", renderRadicals);
```

## 18. Offline và PWA

File `manifest.webmanifest` cấu hình app như một PWA:

- Tên app: `Kanji Renshuu`.
- Chế độ hiển thị: `standalone`.
- Màu nền và theme.
- Icon 192, 512 và maskable icon.

File `sw.js` dùng cache name:

```js
kanji-renshuu-v29
```

Danh sách app shell được cache:

- `index.html`
- `manifest.webmanifest`
- `assets/css/styles.css`
- `assets/js/app.js`
- `assets/js/constants.js`
- `assets/js/data.js`
- `assets/js/dom.js`
- `assets/js/quiz.js`
- `assets/js/radicals.js`
- `assets/js/ui.js`
- `assets/js/utils.js`
- `assets/data/kanji-cache.json`
- `assets/data/radicals.json`
- `libs/xlsx.full.min.js`
- Các icon trong `assets/icons`

Luồng service worker:

### Install

1. Mở cache.
2. Add toàn bộ app shell vào cache.
3. Gọi `self.skipWaiting()`.

### Activate

1. Lấy danh sách cache hiện có.
2. Xóa các cache cũ khác `CACHE_NAME`.
3. Gọi `self.clients.claim()`.

### Fetch

Với request navigate:

1. Tìm `index.html` trong cache trước.
2. Nếu có cache, trả về ngay để offline/slow network mở app nhanh hơn.
3. Đồng thời thử fetch bản mới từ network.
4. Nếu fetch thành công, cập nhật lại `index.html` trong cache.
5. Nếu chưa có cache, mới chờ fetch network và fallback về cache nếu fetch fail.

Với request GET khác:

1. Tìm trong cache trước.
2. Nếu có cache, trả cache.
3. Nếu chưa có, fetch network.
4. Nếu response hợp lệ, clone response và lưu vào cache.

Ngoài service worker, dữ liệu Kanji còn có 2 lớp offline riêng:

1. `assets/data/kanji-cache.json`: seed tĩnh nằm trong app shell cache, giúp lần đầu không có internet vẫn có dữ liệu tối thiểu.
2. `localStorage`: cache động cho dữ liệu đã import/cập nhật từ Google Sheets, URL, Excel hoặc CSV.

Dữ liệu bộ thủ nằm trong app shell cache nên có thể đọc offline sau khi service worker cache thành công.

## 19. Luồng offline dữ liệu Kanji

Khi mở app, `autoLoadDefaultUrl()` chạy theo thứ tự:

```text
Mở app
  -> Thử đọc localStorage
  -> Nếu có, dùng dữ liệu đã import/cập nhật gần nhất
  -> Nếu không có, fetch assets/data/kanji-cache.json
  -> Nếu đọc được JSON, dùng seed Kanji đi kèm app
  -> Nếu JSON cũng fail, dùng fallbackData trong code
  -> Nếu trình duyệt online, fetch URL mặc định để cập nhật
  -> Nếu cập nhật thành công, ghi dữ liệu mới vào localStorage
```

Ý nghĩa:

- Lần đầu mở app không có internet vẫn có dữ liệu từ `kanji-cache.json`.
- Các lần sau, nếu từng import thành công, app ưu tiên dữ liệu mới trong `localStorage`.
- File `kanji-cache.json` không tự thay đổi khi app chạy. Nó chỉ được cập nhật khi sửa file trong repo.
- Dữ liệu từ internet chỉ tự động cập nhật vào cache của browser/localStorage.

## 20. Chạy project local

Có thể chạy server local bằng:

```bash
node dev-server.mjs
```

Mặc định app chạy tại:

```text
http://localhost:8000/
```

Nếu muốn đổi port, set biến môi trường `PORT`.

Ví dụ:

```bash
$env:PORT=3000
node dev-server.mjs
```

## 21. Luồng tổng quát rút gọn

Toàn bộ app có thể hiểu theo pipeline:

```text
Mở app
  -> Load theme
  -> Đồng bộ mode select
  -> Mở tab Luyện tập
  -> Đọc localStorage
  -> Nếu chưa có thì đọc assets/data/kanji-cache.json
  -> Nếu có mạng thì cập nhật từ Google Sheets/URL
  -> Tải dữ liệu 214 bộ thủ
  -> Người dùng chọn mode, số câu, bài
  -> Bấm bắt đầu
  -> Lọc dữ liệu
  -> Tạo quizItems
  -> Render câu hỏi
  -> Chọn đáp án
  -> Xác nhận
  -> Chấm điểm
  -> Câu tiếp theo
  -> Hoàn thành và hiện điểm
```

Với tab tra cứu bộ thủ:

```text
Mở app
  -> Tải assets/data/radicals.json
  -> Tạo filter số nét
  -> Render danh sách bộ thủ
  -> Người dùng bấm tab Tra cứu bộ thủ
  -> Tìm kiếm hoặc lọc số nét
  -> Render lại danh sách kết quả
```

## 22. Ghi chú kỹ thuật

- Logic JavaScript đã được chia theo module trong `assets/js`.
- `assets/js/app.js` chỉ nên giữ vai trò entrypoint/orchestration, tránh đưa thêm logic domain lớn vào đây.
- App không dùng framework frontend.
- App đọc Excel bằng thư viện `XLSX` trong `assets/js/data.js`.
- App đọc CSV bằng parser tự viết trong `assets/js/data.js`.
- App có 3 lớp offline:
  - Service worker cache app shell.
  - `assets/data/kanji-cache.json` làm seed tĩnh cho dữ liệu Kanji.
  - `localStorage` cache dữ liệu Kanji đã import/cập nhật.
- Dữ liệu 214 bộ thủ được lưu trong repo tại `assets/data/radicals.json` và được cache bằng service worker.
- Browser không thể tự ghi ngược vào `assets/data/kanji-cache.json`; nếu cần cập nhật file này cần sửa repo hoặc dùng script ngoài browser.
- Khi thêm file JS module mới, cần thêm file đó vào `APP_SHELL` trong `sw.js` để PWA offline không bị thiếu dependency.
- Giao diện có 2 tab riêng:
  - `practicePanel`: luyện tập.
  - `radicalsPanel`: tra cứu bộ thủ.
- Nút `Làm lại` đang reset cả data và tải lại từ URL, không chỉ reset quiz.
- Một số chữ tiếng Việt/Kanji trong file có dấu hiệu bị lỗi encoding khi đọc bằng PowerShell. Nếu sửa text UI, nên đảm bảo file được lưu bằng UTF-8.

## 23. Từ điển Kanji và Gửi Sheets (Dictionary & Apps Script)

App tích hợp module từ điển trong `assets/js/dictionary.js`.

### 23.1. Luồng tra cứu và Autocomplete

Hàm xử lý nhập liệu:

```js
handleDictSearchInput(e)
```

Luồng xử lý:

1. Người dùng gõ vào ô tìm kiếm `dictSearchInput`.
2. App thực hiện tìm kiếm local tức thì bằng `searchLocal(query)`, lọc trong dữ liệu bộ thủ và dữ liệu Kanji đang có. Hiển thị ngay lên dropdown.
3. Đồng thời debouncing (300ms) gọi API `searchMazii(query)`.
4. Khi API trả về, dùng `mergeResults(local, api)` để gộp và ưu tiên hiển thị kết quả API.
5. Hiển thị dropdown qua `renderAutocomplete()`.
6. Khi người dùng click chọn 1 kết quả, gọi `openDictionary(selectedKanji)`.

### 23.2. Luồng hiển thị Kanji chi tiết

Hàm chính:

```js
openDictionary(kanji)
```

Luồng xử lý:

1. Mở modal `kanjiDictModal`.
2. Nếu có truyền `kanji`, hiển thị UI loading `renderLoadingState()`.
3. Lưu vào lịch sử `dictHistory` để hỗ trợ nút Quay lại. Cập nhật trạng thái hiển thị của `dictBackBtn`.
4. Gọi `lookupKanji(kanji)`:
   - Kiểm tra `lookupCache`, nếu có trả về ngay.
   - Nếu không, gọi `fetchFromMazii(kanji)`.
   - Nếu Mazii API lỗi, gọi fallback `fetchFromKanjiApi(kanji)`.
   - Lưu kết quả vào `lookupCache`.
5. Gọi `setCurrentKanjiData(data)` để lưu state hiện tại cho việc Thêm vào Sheets.
6. Gọi `renderDictionaryContent(data)` để vẽ UI chi tiết (âm Hán, nét vẽ, bộ thủ, từ vựng).
7. Gắn event cho nút `dictPlayStrokeBtn` để gọi `playKanjiGuide(kanji)` (vẽ hoạt ảnh nét chữ).

### 23.3. Luồng thêm Kanji vào Sheets

Khi bấm nút Thêm, app gọi:

```js
openAddKanjiModal()
```

Luồng xử lý:

1. Lấy thông tin từ `currentKanjiData`.
2. Điền sẵn các field chữ Kanji và Âm Hán Việt vào `kanjiAddModal`.
3. Người dùng nhập "Bài số mấy" và "Cách nhớ".
4. Bấm gửi, app gọi `submitAddKanji()`.

Bên trong `submitAddKanji()`:

1. Đọc `appsScriptUrlInput` từ giao diện (đã lưu trong `localStorage`). Nếu trống, báo lỗi.
2. Kiểm tra input bắt buộc (Bài số mấy).
3. Tạo query string `?lesson=...&kanji=...&hanviet=...&mnemonic=...`.
4. Dùng `fetch()` gửi GET request đến URL Google Apps Script.
5. Nhận JSON response từ Sheets:
   - Nếu `status === "exists"`, báo chữ Kanji đã tồn tại.
   - Nếu `status === "success"`, báo thêm thành công và tự động đóng modal sau 1.5s.
6. Xử lý lỗi catch và hiển thị lên `kanjiAddStatus`.

## 24. Bảng vẽ Kanji (Whiteboard)

Tính năng bảng vẽ nằm trong `assets/js/whiteboard.js` để giúp người dùng tự viết tay chữ Hán.

### 24.1. Luồng Bật/Tắt

- Nhấn phím `W` trong quiz, hàm `handleKeyboardShortcut` bắt sự kiện và gọi `toggleWhiteboard()`.
- Lần đầu mở, hàm `initWhiteboard()` gắn các event `pointerdown`, `pointermove`, `pointerup` vào canvas.
- Bắt đầu render loop bằng `startRenderLoop()`.

### 24.2. Luồng vẽ nét (Drawing Loop)

Để đảm bảo hiệu năng cao trên mobile/tablet, Whiteboard dùng `requestAnimationFrame`:

1. **pointerdown**: Lấy tọa độ chuột/cảm ứng, cập nhật `isDrawing = true`, gọi `saveSnapshot()` để lưu trạng thái canvas hiện tại vào mảng `undoStack` (tối đa 30 bước).
2. **pointermove**: Nếu `isDrawing`, đưa tọa độ mới vào mảng `pendingPoints` và set cờ `needsRender = true`.
3. **renderLoop (rAF)**: Chạy liên tục theo refresh rate của màn hình.
   - Nếu `needsRender` và có `pendingPoints`, rút các điểm ra.
   - Dùng hàm `smooth()` tính toán đường cong Bézier để làm mềm các góc cạnh (smoothing).
   - Gọi `ctx.lineTo()` và `ctx.stroke()` để vẽ mực lên canvas.
4. **pointerup**: Đặt `isDrawing = false`.

### 24.3. Luồng Undo

Khi người dùng bấm `Ctrl + Z`:

1. Bắt sự kiện trong `handleKeyboardShortcut`.
2. Gọi `whiteboardUndo()`.
3. Lấy `ImageData` cuối cùng từ `undoStack`.
4. Vẽ lại lên canvas bằng `ctx.putImageData()`.
