# Luong Project Kanji Renshuu

## 1. Tong quan

Kanji Renshuu la mot web app tinh/PWA dung de luyen Kanji bang du lieu tu Excel, CSV hoac Google Sheets.

Project gom cac file chinh:

- `index.html`: dung giao dien chinh.
- `assets/js/app.js`: xu ly toan bo logic cua app.
- `assets/css/styles.css`: style giao dien.
- `assets/data/radicals.json`: du lieu 214 bo thu Kanji/Kangxi.
- `libs/xlsx.full.min.js`: thu vien doc file Excel.
- `sw.js`: service worker cho cache/offline.
- `manifest.webmanifest`: cau hinh PWA.
- `dev-server.mjs`: server local don gian de chay app.

## 2. Luong khoi dong app

Khi mo `index.html`, trinh duyet load theo thu tu:

1. CSS tu `assets/css/styles.css`.
2. Thu vien Excel `libs/xlsx.full.min.js`.
3. File logic `assets/js/app.js`.

Trong `assets/js/app.js`, khi su kien `DOMContentLoaded` chay, app goi:

```js
loadThemePreference();
setModeSelectValue(modeSelect.value);
setActiveTab("practicePanel");
autoLoadDefaultUrl();
loadRadicalsData();
```

Y nghia:

1. `loadThemePreference()` doc theme sang/toi tu `localStorage`. Neu chua co thi lay theo theme cua he thong.
2. `setModeSelectValue()` dong bo segmented control voi select that.
3. `setActiveTab("practicePanel")` dat tab mac dinh la tab luyen tap.
4. `autoLoadDefaultUrl()` tu dong tai du lieu tu URL mac dinh trong o input.
5. `loadRadicalsData()` tai file JSON 214 bo thu de phuc vu tab tra cuu.

Sau khi trang load xong, app dang ky service worker:

```js
navigator.serviceWorker.register("./sw.js")
```

Neu dang ky service worker that bai, app van chay binh thuong, chi mat tinh nang PWA/offline cache cua app shell.

## 3. Cau truc giao dien

Giao dien trong `index.html` co 2 tab chinh:

- Tab `Luyen tap`: gom setup card va quiz area.
- Tab `Tra cuu bo thu`: gom cong cu tim kiem/lien ket du lieu 214 bo thu.

Hai tab duoc dieu khien bang:

- `practiceTabBtn`
- `radicalsTabBtn`
- `practicePanel`
- `radicalsPanel`

Ham dieu khien:

```js
setActiveTab(panelId)
```

Ham nay:

1. Toggle class `hidden` tren cac `.tab-panel`.
2. Cap nhat `aria-hidden` cho panel.
3. Cap nhat class `active` va `aria-selected` cho nut tab.

### 3.1. Practice tab

Day la tab mac dinh khi mo app, co 2 khu vuc chinh.

#### 3.1.1. Setup card

Day la khu vuc cau hinh truoc khi bat dau luyen tap.

Bao gom:

- Chon file Excel/CSV: `fileInput`.
- Chon che do luyen: `modeSelect`.
- Nhap so cau: `questionCount`.
- Nut chon so cau toi da: `maxQuestionBtn`.
- Loc theo bai:
  - `lessonFrom`
  - `lessonTo`
- Nhap URL Excel/CSV/Google Sheets: `urlInput`.
- Nut import tu URL: `importBtn`.
- Nut bat dau luyen tap: `startBtn`.
- Vung hien thi trang thai: `fileInfo`.
- Vung hien thi loi: `errorMessage`.

#### 3.1.2. Quiz area

Khu vuc quiz ban dau bi an bang class `hidden`.

Bao gom:

- Trang thai cau hoi: `quizStatus`.
- Diem hien tai: `scoreInfo`.
- Noi dung cau hoi: `questionPrompt`.
- Danh sach dap an: `options`.
- Nut xac nhan: `confirmBtn`.
- Nut cau tiep theo: `nextBtn`.
- Nut lam lai: `resetBtn`.

Khi nguoi dung bam "Bat dau luyen tap", neu tao quiz thanh cong thi khu vuc nay moi hien ra.

### 3.2. Radicals tab

Day la tab tra cuu 214 bo thu.

Bao gom:

- Vung dem ket qua: `radicalsCount`.
- O tim kiem: `radicalsSearch`.
- Bo loc so net: `radicalsStrokeFilter`.
- Luoi hien thi bo thu: `radicalsGrid`.
- Vung thong bao: `radicalsMessage`.

Moi item bo thu hien:

- Ky tu bo thu chinh.
- So thu tu.
- Am Han Viet.
- So net.
- Nghia.
- Cac dang bien the neu co.

## 4. Luong du lieu

App co 2 nhom du lieu:

1. Du lieu Kanji de luyen tap.
2. Du lieu bo thu de tra cuu.

Du lieu Kanji co 3 nguon:

1. Google Sheets / URL.
2. File local Excel hoac CSV.
3. Du lieu mau fallback.

### 4.1. Du lieu tu Google Sheets / URL

Ham chinh:

```js
parseRemoteUrl(url)
```

Luong xu ly:

1. Nguoi dung bam `Import tu URL`, hoac app tu dong goi `autoLoadDefaultUrl()` khi mo trang.
2. URL duoc dua vao `parseRemoteUrl(url)`.
3. Neu URL la Google Sheets, app goi `normalizeGoogleSheetsUrl(url)` de doi link edit thanh link export CSV.
4. App dung `fetch()` de tai du lieu.
5. Neu response la CSV, app doc text va goi `loadCsvText(text)`.
6. Neu response la Excel, app doc buffer va goi `parseExcelBuffer(buffer)`.
7. Neu khong xac dinh duoc ro kieu file, app thu doc nhu CSV.
8. Du lieu sau cung duoc dua vao `loadDataFromJson(json)`.

Neu fetch that bai, app thu doc du lieu da cache trong `localStorage` bang `loadKanjiDataFromStorage()`.

### 4.2. Du lieu tu file local

Event chinh:

```js
fileInput.addEventListener("change", ...)
```

Luong xu ly:

1. Nguoi dung chon file.
2. App kiem tra ten file.
3. Neu file ket thuc bang `.csv`, goi `parseCsv(file)`.
4. Neu file ket thuc bang `.xlsx` hoac `.xls`, goi `parseExcel(file)`.
5. Neu khong dung dinh dang, hien loi.

Voi CSV:

1. `parseCsv(file)` doc file bang `FileReader`.
2. Sau khi doc xong, goi `loadCsvText(csv)`.
3. `loadCsvText()` tach header va cac dong du lieu.
4. Moi dong CSV duoc map thanh object JSON.
5. Goi `loadDataFromJson(json)`.

Voi Excel:

1. `parseExcel(file)` doc file thanh `ArrayBuffer`.
2. Goi `parseExcelBuffer(buffer)`.
3. `parseExcelBuffer()` dung thu vien `XLSX`.
4. Lay sheet dau tien trong workbook.
5. Chuyen sheet thanh JSON.
6. Goi `loadDataFromJson(json)`.

### 4.3. Du lieu fallback

Neu chua co du lieu import, app dung `fallbackData`.

Ham chon nguon du lieu:

```js
function getSourceData() {
  return kanjiData.length ? kanjiData : fallbackData;
}
```

Nghia la:

- Neu `kanjiData` co du lieu, dung du lieu that.
- Neu `kanjiData` rong, dung du lieu mau.

### 4.4. Du lieu 214 bo thu

Du lieu bo thu nam trong:

```text
assets/data/radicals.json
```

Moi item co dang:

```js
{
  id: 1,
  radical: "一",
  variants: [],
  strokes: 1,
  hanViet: "nhat",
  meaning: "mot"
}
```

Trong do:

- `id`: so thu tu bo thu.
- `radical`: ky tu bo thu chinh.
- `variants`: cac dang bien the.
- `strokes`: so net.
- `hanViet`: am Han Viet.
- `meaning`: nghia tieng Viet.

Ham tai du lieu:

```js
loadRadicalsData()
```

Luong xu ly:

1. Goi `fetch("assets/data/radicals.json")`.
2. Parse response thanh JSON.
3. Kiem tra du lieu la array va khong rong.
4. Gan vao bien `radicalsData`.
5. Goi `populateRadicalStrokeFilter()` de tao danh sach so net.
6. Goi `renderRadicals()` de hien thi danh sach ban dau.

Neu tai that bai, app cap nhat `radicalsCount` va `radicalsMessage` de bao loi.

## 5. Chuan hoa du lieu

Ham quan trong:

```js
loadDataFromJson(json)
```

Ham nay tim cac cot can thiet trong file.

Cot Kanji co the co ten:

- `Kanji`
- `kanji`
- `漢字`
- `kanji `
- `B`

Cot am Han / reading co the co ten:

- `Âm Hán`
- `ÂmHán`
- `reading`
- `Hán`
- `âm hán`
- `am han`
- `C`

Cot bai / lesson co the co ten:

- `Bài`
- `bài`
- `Bai`
- `lesson`
- `Lesson`
- `A`

Sau khi tim duoc cot, moi dong du lieu duoc chuan hoa thanh:

```js
{
  kanji: "...",
  reading: "...",
  lesson: 1
}
```

Trong do:

- `kanji`: chu Kanji.
- `reading`: am Han.
- `lesson`: so bai, neu khong co thi la `null`.

Nhung dong thieu Kanji hoac reading se bi loai.

Neu du lieu hop le, app goi:

```js
setKanjiData(data, Boolean(lessonKey));
saveKanjiDataToStorage();
```

Ket qua:

- Du lieu duoc luu vao bien `kanjiData`.
- Trang thai co/khong co cot bai duoc luu vao `hasLessonInfo`.
- Du lieu duoc cache vao `localStorage`.

Key cache:

```js
kanji-renshuu-data-v1
```

## 6. Luong tao quiz

Khi nguoi dung bam nut "Bat dau luyen tap", event cua `startBtn` chay.

Luong xu ly:

1. Neu chua co `kanjiData`, app bao dang dung du lieu mau.
2. Goi `buildQuiz()`.
3. Neu `buildQuiz()` tra ve `false`, dung lai va hien loi.
4. Neu thanh cong, goi `showQuizArea()`.

Ham tao quiz:

```js
buildQuiz()
```

Ben trong `buildQuiz()`:

1. Lay so cau tu input `questionCount`.
2. Gioi han so cau trong khoang hop le, toi da `MAX_QUESTION_COUNT = 300`.
3. Goi `getFilteredSourceData()` de lay du lieu da loc theo bai.
4. Kiem tra loi loc bai.
5. Kiem tra co du item de tao quiz khong.
6. Shuffle danh sach cau hoi.
7. Lay dung so cau can luyen.
8. Reset trang thai quiz:
   - `score = 0`
   - `currentIndex = 0`
   - `selectedChoice = null`
   - `selectedButton = null`

## 7. Luong loc theo bai

Ham chinh:

```js
getFilteredSourceData()
```

Luong xu ly:

1. Lay source data bang `getSourceData()`.
2. Doc gia tri `lessonFrom` va `lessonTo`.
3. Xac dinh nguoi dung co nhap "Tu bai" hoac "Den bai" khong.
4. Neu co loc theo bai nhung du lieu khong co cot bai, tra ve loi.
5. Neu `from > to`, tra ve loi.
6. Neu khong nhap pham vi bai, tra ve toan bo source data.
7. Neu co nhap pham vi, chi giu item co `lesson` nam trong khoang.

Ket qua tra ve dang:

```js
{
  data: [...],
  error: ""
}
```

Neu co loi:

```js
{
  data: [],
  error: "..."
}
```

## 8. Luong hien thi cau hoi

Sau khi quiz duoc tao, app goi:

```js
showQuizArea()
```

Ham nay:

1. Goi `setActiveTab("practicePanel")` de dam bao dang o tab luyen tap.
2. Go class `hidden` khoi `quizArea`.
3. Goi `renderQuestion()`.
4. Scroll den khu vuc quiz.

Ham hien thi cau hoi:

```js
renderQuestion()
```

Neu da het cau:

1. Hien text hoan thanh.
2. Xoa danh sach dap an.
3. Hien tong so cau da lam.
4. Hien diem cuoi.
5. An nut xac nhan va nut cau tiep theo.

Neu van con cau:

1. Lay item hien tai tu `quizItems[currentIndex]`.
2. Lay che do hien tai tu `modeSelect.value`.
3. Lay source data bang `getSourceData()`.
4. Tao danh sach dap an bang `buildChoices(item, source, mode)`.
5. Shuffle dap an.
6. Xoa dap an cu trong `optionsContainer`.
7. Render tung dap an thanh button.
8. Cap nhat cau hoi theo mode:
   - `reading-to-kanji`: nhin am Han, chon Kanji.
   - `kanji-to-reading`: nhin Kanji, chon am Han.
9. Cap nhat trang thai cau hoi va diem.
10. Hien nut `Xac nhan`.
11. An nut `Cau tiep theo`.

## 9. Luong tao dap an

Ham chinh:

```js
buildChoices(item, source, mode)
```

Muc tieu: tao toi da 4 lua chon, trong do co 1 dap an dung.

Luong xu ly:

1. Dua item dung vao danh sach `choices`.
2. Tao `usedDisplayValues` de tranh trung gia tri hien thi.
3. Loc danh sach ung vien sai:
   - Loai item trung ca Kanji va reading voi cau hien tai.
   - Loai item co reading trung sau khi normalize.
   - Loai item co gia tri hien thi da duoc dung.
4. Shuffle ung vien sai.
5. Them ung vien vao `choices` cho den khi du 4 dap an.
6. Tra ve danh sach dap an.

So dap an toi da:

```js
MAX_OPTION_COUNT = 4
```

## 10. Luong chon dap an

Khi nguoi dung bam vao mot dap an, app goi:

```js
selectAnswer(choice, button)
```

Ham nay:

1. Neu truoc do da chon dap an khac, go class `selected` khoi button cu.
2. Gan `selectedChoice = choice`.
3. Gan `selectedButton = button`.
4. Them class `selected` vao button moi.

Tai thoi diem nay app chua cham diem. Cham diem chi xay ra khi bam `Xac nhan`.

## 11. Luong xac nhan dap an

Khi nguoi dung bam `Xac nhan`, app goi:

```js
confirmAnswer()
```

Luong xu ly:

1. Neu chua chon dap an, hien loi.
2. Lay item hien tai tu `quizItems[currentIndex]`.
3. So sanh dap an da chon voi dap an dung:

```js
selectedChoice.kanji === item.kanji &&
selectedChoice.reading === item.reading
```

4. Neu dung:
   - Tang `score`.
   - Button duoc them class `correct`.
5. Neu sai:
   - Button da chon duoc them class `wrong`.
   - Dap an dung duoc them class `correct`.
6. Disable tat ca option.
7. Cap nhat diem.
8. An nut `Xac nhan`.
9. Hien nut `Cau tiep theo`.

## 12. Luong cau tiep theo va ket thuc quiz

Khi nguoi dung bam `Cau tiep theo`, app chay:

```js
currentIndex += 1;
renderQuestion();
```

Neu `currentIndex` van nho hon tong so cau, app hien cau tiep theo.

Neu `currentIndex >= quizItems.length`, `renderQuestion()` hien man hinh hoan thanh va diem cuoi:

```js
score / quizItems.length
```

## 13. Luong lam lai

Khi bam nut `Lam lai`, app chay:

```js
resetBtn.addEventListener("click", ...)
```

Luong xu ly:

1. An `quizArea`.
2. Xoa `kanjiData`.
3. Xoa `quizItems`.
4. Reset `currentIndex = 0`.
5. Reset `score = 0`.
6. Cap nhat `fileInfo`.
7. An loi.
8. Goi `autoLoadDefaultUrl()` de tai lai du lieu tu URL/cache.

Luu y: nut `Lam lai` hien tai khong chi reset bai quiz, ma con reset ca du lieu dang dung roi tai lai tu URL mac dinh.

## 14. Luong dark mode

App dung key:

```js
kanji-renshuu-theme
```

Cac ham lien quan:

- `loadThemePreference()`
- `applyTheme(theme)`
- `toggleTheme()`

Luong xu ly:

1. Khi mo app, doc theme da luu trong `localStorage`.
2. Neu khong co, dung `prefers-color-scheme`.
3. Khi bam nut theme, app doi giua `light` va `dark`.
4. Theme moi duoc luu lai vao `localStorage`.
5. Body duoc toggle class `dark-mode`.

## 15. Luong segmented mode control

App co select that:

```html
<select id="modeSelect">
```

Select that duoc an bang class `native-select`, con UI nguoi dung thay la segmented control gom 2 nut:

- `Âm Hán -> Kanji`
- `Kanji -> Âm Hán`

Cac ham lien quan:

- `setModeSelectValue(value)`

Khi bam mot mode segment:

1. Cap nhat `modeSelect.value`.
2. Cap nhat class `active` tren cac nut segment.
3. Cap nhat `aria-pressed` de phan anh trang thai dang chon.
4. Quiz doc mode hien tai tu `modeSelect.value`.

## 16. Phim tat

Ham xu ly phim tat:

```js
handleKeyboardShortcut(event)
```

Cac phim tat:

- `Enter` khi quiz dang an: bat dau luyen tap.
- `R`: lam lai.
- `M`: dat so cau bang max theo du lieu hien tai.
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`: di chuyen/chon option.
- `Enter` trong quiz:
  - Neu nut `Cau tiep theo` dang hien, chuyen sang cau tiep theo.
  - Neu nut `Xac nhan` dang hien, xac nhan dap an.
  - Neu chua chon dap an, app tu chon option dau tien roi xac nhan.

Ham `isTypingTarget()` giup bo qua phim tat khi nguoi dung dang go trong input/select/textarea.

Luu y voi tab:

- Phim tat quiz chi hoat dong khi `practicePanel` dang hien.
- Khi dang o tab `Tra cuu bo thu`, `handleKeyboardShortcut()` return som de tranh bam Enter/R/M lam anh huong quiz.

## 17. Luong tra cuu bo thu

Du lieu bo thu duoc load mot lan khi `DOMContentLoaded`.

Cac ham lien quan:

- `loadRadicalsData()`
- `populateRadicalStrokeFilter()`
- `getFilteredRadicals()`
- `renderRadicals()`
- `normalizeSearchText(value)`
- `getRadicalSearchText(item)`

### 17.1. Tao bo loc so net

Ham:

```js
populateRadicalStrokeFilter()
```

Luong xu ly:

1. Lay tat ca `strokes` tu `radicalsData`.
2. Dung `Set` de loai trung.
3. Sap xep tang dan.
4. Them cac option vao `radicalsStrokeFilter`.

### 17.2. Tim kiem va loc

Ham:

```js
getFilteredRadicals()
```

Luong xu ly:

1. Doc query tu `radicalsSearch`.
2. Normalize query bang `normalizeSearchText()`:
   - Trim text.
   - Tach dau tieng Viet bang `NFD`.
   - Loai combining marks.
   - Chuyen ve lowercase.
3. Doc so net tu `radicalsStrokeFilter`.
4. Loc theo so net neu nguoi dung co chon.
5. Neu co query, so khop voi chuoi gom:
   - `id`
   - `radical`
   - `hanViet`
   - `meaning`
   - `strokes`
   - `variants`

### 17.3. Render danh sach bo thu

Ham:

```js
renderRadicals()
```

Luong xu ly:

1. Goi `getFilteredRadicals()`.
2. Xoa noi dung cu trong `radicalsGrid`.
3. Cap nhat `radicalsCount` theo dang `x / 214 bo`.
4. Neu khong co ket qua, hien thong bao trong `radicalsMessage`.
5. Neu co ket qua, render moi item thanh `article.radical-item`.

### 17.4. Event cua tab tra cuu

```js
radicalsSearchInput.addEventListener("input", renderRadicals);
radicalsStrokeFilter.addEventListener("change", renderRadicals);
```

## 18. Offline va PWA

File `manifest.webmanifest` cau hinh app nhu mot PWA:

- Ten app: `Kanji Renshuu`.
- Che do hien thi: `standalone`.
- Mau nen va theme.
- Icon 192, 512 va maskable icon.

File `sw.js` dung cache name:

```js
kanji-renshuu-v25
```

Danh sach app shell duoc cache:

- `index.html`
- `manifest.webmanifest`
- `assets/css/styles.css`
- `assets/js/app.js`
- `assets/data/radicals.json`
- `libs/xlsx.full.min.js`
- Cac icon trong `assets/icons`

Luong service worker:

### Install

1. Mo cache.
2. Add toan bo app shell vao cache.
3. Goi `self.skipWaiting()`.

### Activate

1. Lay danh sach cache hien co.
2. Xoa cac cache cu khac `CACHE_NAME`.
3. Goi `self.clients.claim()`.

### Fetch

Voi request navigate:

1. Thu fetch tu network.
2. Neu fail, tra ve `index.html` trong cache.

Voi request GET khac:

1. Tim trong cache truoc.
2. Neu co cache, tra cache.
3. Neu chua co, fetch network.
4. Neu response hop le, clone response va luu vao cache.

Ngoai service worker, du lieu Kanji con duoc cache rieng trong `localStorage`, giup app co the dung du lieu da import khi mat mang.

Du lieu bo thu nam trong app shell cache nen co the doc offline sau khi service worker cache thanh cong.

## 19. Chay project local

Co the chay server local bang:

```bash
node dev-server.mjs
```

Mac dinh app chay tai:

```text
http://localhost:8000/
```

Neu muon doi port, set bien moi truong `PORT`.

Vi du:

```bash
$env:PORT=3000
node dev-server.mjs
```

## 20. Luong tong quat rut gon

Toan bo app co the hieu theo pipeline:

```text
Mo app
  -> Load theme
  -> Dong bo mode select
  -> Mo tab Luyen tap
  -> Tu tai du lieu Google Sheets/cache
  -> Tai du lieu 214 bo thu
  -> Nguoi dung chon mode, so cau, bai
  -> Bam bat dau
  -> Loc du lieu
  -> Tao quizItems
  -> Render cau hoi
  -> Chon dap an
  -> Xac nhan
  -> Cham diem
  -> Cau tiep theo
  -> Hoan thanh va hien diem
```

Voi tab tra cuu bo thu:

```text
Mo app
  -> Tai assets/data/radicals.json
  -> Tao filter so net
  -> Render danh sach bo thu
  -> Nguoi dung bam tab Tra cuu bo thu
  -> Tim kiem hoac loc so net
  -> Render lai danh sach ket qua
```

## 21. Ghi chu ky thuat

- Logic hien tai nam gan nhu toan bo trong `assets/js/app.js`.
- App khong dung framework frontend.
- App doc Excel bang thu vien `XLSX`.
- App doc CSV bang parser tu viet trong `splitCsvLine()`.
- App co 2 lop offline:
  - Service worker cache app shell.
  - `localStorage` cache du lieu Kanji.
- Du lieu 214 bo thu duoc luu trong repo tai `assets/data/radicals.json` va duoc cache bang service worker.
- Giao dien co 2 tab rieng:
  - `practicePanel`: luyen tap.
  - `radicalsPanel`: tra cuu bo thu.
- Nut `Lam lai` dang reset ca data va tai lai tu URL, khong chi reset quiz.
- Mot so chu tieng Viet/Kanji trong file co dau hieu bi loi encoding khi doc bang PowerShell. Neu sua text UI, nen dam bao file duoc luu bang UTF-8.
