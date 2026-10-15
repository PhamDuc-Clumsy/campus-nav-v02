# Remix of Campus Compass

Build the initial prototype of the FPT University Hoa Lac Campus Navigation web app.

1. Interactive Campus Map:

- Build an interactive 2D vector/SVG campus canvas with smooth pan, zoom, and center controls representing the 30ha FPT Hoa Lac campus.

- Pre-populate clickable building nodes with realistic layout:

  * Lecture Halls: Tòa Alpha (iconic dragon wave), Tòa Beta, Tòa Gamma, Tòa Delta.

  * Dormitories: Dom A, Dom B, Dom C, Dom D, Dom E, Dom F, Dom G.

  * Amenities & Landmarks: Hồ Sen, Võ đường Vovinam, Khu thể thao / Sân bóng đá, Canteen & 7-Eleven, Bãi xe.

- Clicking any node opens a sleek bottom drawer showing building name, Vietnamese title, thumbnail, short description, and two action buttons: "Đi từ đây" (Set Start) and "Đến đây" (Set Destination).

2. Point-to-Point Routing & Vehicle Selector:

- Top search bar with origin & destination selectors (supports both dropdown search and direct map tap) plus a swap button.

- Renders an animated route line between the two selected buildings with estimated distance (meters) and travel time.

- Floating bottom-right vehicle bar with 5 toggle options:

  * Walk (Đi bộ)

  * Motor (Xe máy)

  * Car (Ô tô)

  * Bus (Xe buýt / Xe đưa đón)

  * Wheelchair (Xe lăn / Trợ năng)

- Toggling vehicle updates speed, estimated time, and route styling.

3. Quick In-Memory Admin Mode:

- Admin toggle in the top bar that allows clicking on the map to add a new building marker and dragging existing pins to adjust their (x, y) coordinates, persisted in localStorage.

4. Design:

- Modern UI with FPT signature orange accents, Tailwind CSS, and shadcn/ui. Fully responsive on mobile touchscreens and desktop.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fpt-campus-guide.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8be15d70-b327-4508-9a2a-edbf7afa6add).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
