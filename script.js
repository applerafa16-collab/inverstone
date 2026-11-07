
// ==========================================
// 1. CONEXÃO COM SUPABASE
// ==========================================

const SUPABASE_URL = "https://zkywupzzzlpdnplbbsph.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpreXd1cHp6emxwZG5wbGJic3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNzcyODYsImV4cCI6MjEwNTk1MzI4Nn0.YfX2VSK84Qgry4FOVw6VssDYnnyhC2zct1utDwVZ0_M";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// ==========================================
// 2. VARIÁVEIS
// ==========================================

let products = [];
let cart = [];
let selectedCategory = "todos";

const money = value =>
    Number(value).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function safeImage(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" ? parsed.href : "";
    } catch {
        return "";
    }
}

// ==========================================
// 3. CARREGAR PRODUTOS DO BANCO
// ==========================================

async function loadProducts() {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = '<p class="loading">Carregando produtos...</p>';

    const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, description, price, image_url, category")
        .eq("active", true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar produtos:", error);
        grid.innerHTML =
            '<p class="loading">Não foi possível carregar os produtos. Verifique a conexão com o banco.</p>';
        return;
    }

    products = data || [];
    renderProducts();
}

// ==========================================
// 4. MOSTRAR PRODUTOS
// ==========================================

function renderProducts() {
    const grid = document.getElementById("products-grid");
    const search = document.getElementById("search").value.toLowerCase();

    const filtered = products.filter(product => {
        const matchesCategory =
            selectedCategory === "todos" ||
            product.category === selectedCategory;

        const matchesSearch =
            product.name.toLowerCase().includes(search);

        return matchesCategory && matchesSearch;
    });

    if (!filtered.length) {
        grid.innerHTML =
            '<p class="loading">Nenhum produto encontrado.</p>';
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const image = safeImage(product.image_url) ||
            "https://placehold.co/600x700?text=Produto";

        return `
            <article class="product-card">
                <img
                    class="product-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy"
                >

                <div class="product-info">
                    <small>${escapeHTML(product.category)}</small>
                    <h3>${escapeHTML(product.name)}</h3>
                    <p class="product-price">${money(product.price)}</p>

                    <button class="primary-button"
                        onclick="addToCart('${product.id}')">
                        ADICIONAR AO CARRINHO
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

// ==========================================
// 5. FILTROS
// ==========================================

document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelector(".category.active")
            ?.classList.remove("active");

        button.classList.add("active");
        selectedCategory = button.dataset.category;
        renderProducts();
    });
});

document.getElementById("search")
    .addEventListener("input", renderProducts);

// ==========================================
// 6. CARRINHO
// ==========================================

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            quantity: 1
        });
    }

    renderCart();
    toggleCart(true);
}

function changeQuantity(productId, amount) {
    const item = cart.find(p => p.id === productId);
    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        cart = cart.filter(p => p.id !== productId);
    }

    renderCart();
}

function getTotal() {
    return cart.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    );
}

function renderCart() {
    const container = document.getElementById("cart-items");
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);

    document.getElementById("cart-count").textContent = count;
    document.getElementById("cart-total").textContent = money(getTotal());

    if (!cart.length) {
        container.innerHTML = "<p>Seu carrinho está vazio.</p>";
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div>
                <strong>${escapeHTML(item.name)}</strong>
                <p>${money(item.price)}</p>

                <div class="quantity-controls">
                    <button onclick="changeQuantity('${item.id}', -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQuantity('${item.id}', 1)">+</button>
                </div>
            </div>

            <strong>${money(item.price * item.quantity)}</strong>
        </div>
    `).join("");
}

function toggleCart(forceOpen = null) {
    const panel = document.getElementById("cart-panel");
    const overlay = document.getElementById("overlay");

    const shouldOpen = forceOpen === null
        ? !panel.classList.contains("show")
        : forceOpen;

    panel.classList.toggle("show", shouldOpen);
    overlay.classList.toggle("show", shouldOpen);
}

// ==========================================
// 7. FINALIZAR PEDIDO
// ==========================================

function openCheckout() {
    if (!cart.length) {
        alert("Adicione produtos ao carrinho primeiro.");
        return;
    }

    document.getElementById("checkout-total").textContent =
        money(getTotal());

    toggleCart(false);
    document.getElementById("checkout-modal")
        .classList.add("show");
}

function closeCheckout() {
    document.getElementById("checkout-modal")
        .classList.remove("show");
}

// ==========================================
// 8. ENVIAR PEDIDO AO SUPABASE
// ==========================================

document.getElementById("checkout-form")
    .addEventListener("submit", async event => {

        event.preventDefault();

        if (!cart.length) {
            alert("Seu carrinho está vazio.");
            return;
        }

        const button = document.getElementById("submit-order");
        button.disabled = true;
        button.textContent = "ENVIANDO PEDIDO...";

        const form = new FormData(event.target);

        const customer = {
            customer_name: form.get("name").trim(),
            customer_phone: form.get("phone").trim(),
            customer_address: form.get("address").trim()
        };

        const items = cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity
        }));

        try {
            const { data, error } = await supabaseClient.rpc(
                "create_order",
                {
                    p_customer_name: customer.customer_name,
                    p_customer_phone: customer.customer_phone,
                    p_customer_address: customer.customer_address,
                    p_items: items
                }
            );

            if (error) throw error;

            alert(
                "Pedido realizado com sucesso! Número do pedido: " + data
            );

            cart = [];
            renderCart();
            event.target.reset();
            closeCheckout();

        } catch (error) {
            console.error("Erro ao realizar pedido:", error);
            alert("Não foi possível realizar seu pedido. Tente novamente.");
        } finally {
            button.disabled = false;
            button.textContent = "CONFIRMAR PEDIDO";
        }
    });

// ==========================================
// 9. INICIALIZAÇÃO
// ==========================================

renderCart();
loadProducts();
