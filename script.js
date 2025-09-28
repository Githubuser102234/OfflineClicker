// Counter stored in localStorage so it works offline
let count = localStorage.getItem("count") || 0;
const btn = document.getElementById("counterBtn");
btn.textContent = `Clicked ${count} times`;

btn.addEventListener("click", () => {
  count++;
  localStorage.setItem("count", count);
  btn.textContent = `Clicked ${count} times`;
});

// Register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(() => console.log("Service Worker registered"))
    .catch(err => console.log("SW reg failed:", err));
}
