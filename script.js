    let isAdmin = false;

    let products = [
        { id: 1, name: "Rebisco Crackers", price: 10, category: "biscuit", available: true, img: "img/rebisco.jpg" },
        { id: 2, name: "Piattos Cheese", price: 20, category: "junk", available: true, img: "img/piattos.jpeg" },
        { id: 3, name: "Coke Mismo", price: 20, category: "beverage", available: true, img: "img/coke mismo.jpg" },
        { id: 4, name: "Siomai Rice", price: 30, category: "rice", available: true, img: "img/siomairice.jpg" },
        { id: 5, name: "Pancit Canton", price: 30, category: "rice", available: true, img: "img/pancitcanton.jpg" },
        { id: 6, name: "Mountain Dew", price: 20, category: "beverage", available: false, img: "img/moutnaindew.webp" }
    ];

    let cart = [];
    let orders = [];
    let favorites = [];
    let currentCategory = 'biscuit';

    renderMenu();

    function openQRModal() {
     
        const currentUrl = window.location.href; 

        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}`;
        
        const qrImg = document.getElementById('real-qr-code');
        if(qrImg) qrImg.src = qrApi;
        
        const qrText = document.getElementById('qr-link-text');
        if(qrText) qrText.innerText = currentUrl;
        
        openModal('qr-modal');
    }

    function nav(target, el) {
        document.querySelectorAll('.footer-item').forEach(i => i.classList.remove('active'));
        if(el) el.classList.add('active');

        ['view-menu', 'view-cart', 'view-orders', 'view-admin-orders', 'view-favorite', 'view-profile'].forEach(v => {
            document.getElementById(v).classList.add('hidden');
        });

        const topControls = document.getElementById('top-controls');
        const adminBar = document.getElementById('admin-bar');

        if (target === 'menu') {
            document.getElementById('view-menu').classList.remove('hidden');
            renderMenu();
            topControls.classList.remove('hidden');
            if(isAdmin) adminBar.style.display = 'block';
        } else {
            topControls.classList.add('hidden');
            adminBar.style.display = 'none';

            if (target === 'cart') { document.getElementById('view-cart').classList.remove('hidden'); renderCart(); }
            else if (target === 'orders') { document.getElementById('view-orders').classList.remove('hidden'); renderStudentOrders(); }
            else if (target === 'admin-orders') { document.getElementById('view-admin-orders').classList.remove('hidden'); renderAdminOrders(); }
            else if (target === 'favorite') { document.getElementById('view-favorite').classList.remove('hidden'); renderFavorites(); }
            else if (target === 'profile') { document.getElementById('view-profile').classList.remove('hidden'); }
        }
    }

    function filterMenu(el, cat) {
        currentCategory = cat;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        renderMenu();
    }

    function renderMenu() {
        const container = document.getElementById('menu-container');
        container.innerHTML = "";
        const filtered = products.filter(p => p.category === currentCategory);
        
        if(filtered.length === 0) {
            container.innerHTML = "<p class='text-center' style='color:#888; margin-top:20px'>No items here.</p>";
            return;
        }

        filtered.forEach(p => {
            let controls = "";
            let opacity = p.available ? 1 : 0.6;
            let imgSrc = p.img ? p.img : 'https://placehold.co/70?text=No+Img';
            let statusBadge = p.available ? `<span class="status avail">Available</span>` : `<span class="status out">Out of Stock</span>`;

            if (isAdmin) {
                controls = `
                    <div class="admin-controls">
                        <button class="btn btn-danger" onclick="toggleStock(${p.id})">${p.available ? 'Out' : 'In'}</button>
                        <button class="btn btn-blue" onclick="deleteProduct(${p.id})">Del</button>
                        <input class="edit-input" type="number" value="${p.price}" onchange="updatePrice(${p.id}, this.value)">
                    </div>
                `;
            } else {
                const isFav = favorites.some(f => f.name === p.name);
                const favColor = isFav ? 'red' : '#ccc';
                const favClass = isFav ? 'active' : '';

                if(p.available) {
                    controls = `
                        <button class="fav-btn ${favClass}" style="color:${favColor}" onclick="toggleFav(this, '${p.name}', ${p.price})">❤</button>
                        <button class="btn btn-add" onclick="addToCart(${p.id})">Add +</button>
                    `;
                } else {
                    controls = `<button class="btn" disabled>Sold Out</button>`;
                }
            }

            container.innerHTML += `
                <div class="product-card" style="opacity: ${opacity}">
                    <img src="${imgSrc}" class="product-img" alt="${p.name}">
                    <div class="product-info">
                        <p class="product-name">${p.name}</p>
                        <p class="product-price">₱${p.price}</p>
                        ${statusBadge}
                        ${controls}
                    </div>
                </div>
            `;
        });
    }

    function toggleStock(id) {
        const p = products.find(x => x.id === id);
        p.available = !p.available;
        renderMenu();
    }
    function updatePrice(id, newPrice) {
        const p = products.find(x => x.id === id);
        p.price = parseInt(newPrice);
    }
    function deleteProduct(id) {
        if(confirm("Delete this item?")) {
            products = products.filter(p => p.id !== id);
            renderMenu();
        }
    }
    function addNewProduct() {
        const name = document.getElementById('new-name').value;
        const price = document.getElementById('new-price').value;
        const cat = document.getElementById('new-cat').value;
        const img = document.getElementById('new-img').value; 
        
        if(name && price) {
            products.push({ 
                id: Date.now(), name, price: parseInt(price), category: cat, available: true,
                img: img || "https://placehold.co/70?text=New" 
            });
            closeModal('add-product-modal');
            renderMenu();
            alert("Product Added!");
        }
    }

    function addToCart(id) {
        const p = products.find(x => x.id === id);
        cart.push(p);
        alert(`${p.name} added!`);
    }

    function renderCart() {
        const container = document.getElementById('cart-container');
        const actions = document.getElementById('cart-actions');
        if(cart.length === 0) {
            container.innerHTML = "<p class='text-center' style='color:#888; margin-top:50px'>Empty Cart</p>";
            actions.classList.add('hidden');
            return;
        }
        let html = "";
        let total = 0;
        cart.forEach((item, index) => {
            total += item.price;
            html += `
                <div class="product-card">
                    <img src="${item.img}" class="product-img" style="width:50px; height:50px;">
                    <div class="product-info">
                        <strong>${item.name}</strong><br>
                        <small>₱${item.price}</small>
                    </div>
                    <button class="btn btn-danger" onclick="cart.splice(${index},1); renderCart()">Remove</button>
                </div>
            `;
        });
        container.innerHTML = html;
        document.getElementById('cart-total').innerText = total;
        actions.classList.remove('hidden');
    }

    function checkout() {
        const id = Math.floor(Math.random() * 9000) + 1000;
        const total = document.getElementById('cart-total').innerText;
        orders.push({ id: id, items: [...cart], total: total, status: 'Pending', student: 'Juan Dela Cruz' });
        cart = []; renderCart(); nav('orders', null);
        document.querySelectorAll('.footer-item')[2].classList.add('active'); 
        alert("Order Sent!");
    }

    function toggleFav(btn, name, price) {
        const existingIdx = favorites.findIndex(f => f.name === name);
        if(existingIdx === -1) {
            favorites.push({name, price});
            btn.classList.add('active');
            btn.style.color = 'red';
        } else {
            favorites.splice(existingIdx, 1);
            btn.classList.remove('active');
            btn.style.color = '#ccc';
        }
    }

    function renderFavorites() {
        const container = document.getElementById('fav-container');
        if(favorites.length === 0) { container.innerHTML = "<p class='text-center' style='color:#888; margin-top:50px'>No favorites saved.</p>"; return; }
        let html = "";
        favorites.forEach(f => {
            html += `<div class="product-card"><div class="product-info"><strong>${f.name}</strong><br><small>₱${f.price}</small></div><button class="btn btn-add" onclick="alert('Go to menu to add')">View</button></div>`;
        });
        container.innerHTML = html;
    }

    function renderStudentOrders() {
        const container = document.getElementById('student-orders-container');
        if(orders.length === 0) { container.innerHTML = "<p class='text-center' style='color:#888; margin-top:50px'>No active orders.</p>"; return; }
        let html = "";
        orders.slice().reverse().forEach(o => {
            let color = '#999';
            if(o.status === 'Preparing') color = '#ff9800';
            if(o.status === 'Ready') color = '#4caf50';
            if(o.status === 'Declined') color = '#d32f2f';
            html += `
                <div class="order-card" style="border-left-color: ${color}">
                    <div style="display:flex; justify-content:space-between"><strong>Order #${o.id}</strong><span style="color:${color}; font-weight:bold">${o.status}</span></div>
                    <p>Total: ₱${o.total}</p>
                    <small style="color:#666">${o.items.map(i=>i.name).join(', ')}</small>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function renderAdminOrders() {
        const container = document.getElementById('admin-orders-container');
        const active = orders.filter(o => o.status !== 'Picked Up');
        if(active.length === 0) { container.innerHTML = "<p class='text-center' style='color:#888; margin-top:50px'>Queue is empty.</p>"; return; }
        let html = "";
        active.forEach(o => {
            let btns = "";
            if(o.status === 'Pending') { btns = `<button class="btn btn-add" onclick="setStatus(${o.id}, 'Preparing')">Accept</button> <button class="btn btn-danger" onclick="setStatus(${o.id}, 'Declined')">Decline</button>`; } 
            else if(o.status === 'Preparing') { btns = `<button class="btn btn-blue" onclick="setStatus(${o.id}, 'Ready')">Mark Ready</button>`; } 
            else if(o.status === 'Ready') { btns = `<button class="btn btn-add" onclick="setStatus(${o.id}, 'Picked Up')">Complete Order</button>`; } 
            else if(o.status === 'Declined') { btns = `<small style='color:red'>Order Declined</small>`; }
            html += `
                <div class="order-card">
                    <div style="display:flex; justify-content:space-between"><strong>#${o.id} (${o.student})</strong><span>₱${o.total}</span></div>
                    <p style="font-size:12px; margin:5px 0;">${o.items.map(i=>i.name).join(', ')}</p>
                    <p>Status: <b>${o.status}</b></p>
                    <div style="margin-top:10px">${btns}</div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function setStatus(id, status) {
        const o = orders.find(x => x.id === id);
        o.status = status;
        renderAdminOrders();
    }

    function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

    function attemptLogin() {
        const p = document.getElementById('admin-pass').value;
        if(p === '1234') { toggleAdmin(true); closeModal('login-modal'); document.getElementById('admin-pass').value = ''; }
        else { alert("Wrong Password"); }
    }

    function logoutAdmin() { if(confirm("Exit Staff Mode?")) toggleAdmin(false); }

    function toggleAdmin(on) {
        isAdmin = on;
        const header = document.getElementById('header');
        const title = document.getElementById('header-title');
        const container = document.getElementById('app-container');

        if(on) {
            title.innerText = "Canteen ADMIN";
            header.classList.add('admin-mode');
            container.classList.add('admin-mode');
            document.querySelectorAll('.student-only').forEach(e => e.classList.add('hidden'));
            document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('hidden'));
            document.getElementById('login-btn').classList.add('hidden');
            document.getElementById('logout-btn').classList.remove('hidden');
            document.getElementById('profile-name').innerText = "Admin Staff";
            document.getElementById('profile-role').innerText = "Authorized Personnel";
            nav('admin-orders', document.querySelectorAll('.admin-only')[0]);
        } else {
            title.innerText = "Canteen Hub";
            header.classList.remove('admin-mode');
            container.classList.remove('admin-mode');
            document.querySelectorAll('.student-only').forEach(e => e.classList.remove('hidden'));
            document.querySelectorAll('.admin-only').forEach(e => e.classList.add('hidden'));
            document.getElementById('login-btn').classList.remove('hidden');
            document.getElementById('logout-btn').classList.add('hidden');
            document.getElementById('profile-name').innerText = "Juan Dela Cruz";
            document.getElementById('profile-role').innerText = "Student ID: 2026-00451";
            renderMenu();
            nav('menu', document.querySelectorAll('.footer-item')[0]);
        }
    }