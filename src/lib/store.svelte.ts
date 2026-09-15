export interface Product {
	id: string;
	name: string;
	price: number;
	category: string;
}

export interface CartItem {
	product: Product;
	qty: number;
}

export interface Bill {
	id: string;
	name: string;
	customerCount: number;
	billDate: string;
	items: CartItem[];
	createdAt: string;
}

export interface Transaction {
	id: string;
	billName: string;
	customerCount: number;
	items: CartItem[];
	total: number;
	paid: number;
	change: number;
	date: string;
}

function loadProducts(): Product[] {
	if (typeof localStorage === 'undefined') return defaultProducts;
	const saved = localStorage.getItem('pos_products');
	return saved ? JSON.parse(saved) : defaultProducts;
}

function loadTransactions(): Transaction[] {
	if (typeof localStorage === 'undefined') return [];
	const saved = localStorage.getItem('pos_transactions');
	return saved ? JSON.parse(saved) : [];
}

const defaultProducts: Product[] = [
	{ id: '1', name: 'コーヒー', price: 500, category: 'ドリンク' },
	{ id: '2', name: '紅茶', price: 450, category: 'ドリンク' },
	{ id: '3', name: 'ケーキ', price: 600, category: 'フード' },
	{ id: '4', name: 'サンドイッチ', price: 700, category: 'フード' },
];

export const products = $state({ list: loadProducts() });
export const transactions = $state({ list: loadTransactions() });

export const bills = $state<{ list: Bill[]; activeId: string | null }>({
	list: [],
	activeId: null
});

export function activeBill(): Bill | undefined {
	return bills.list.find((b) => b.id === bills.activeId) ?? undefined;
}

export function newBill() {
	const id = Date.now().toString();
	const num = bills.list.length + 1;
	const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
	bills.list.push({ id, name: `伝票 ${num}`, customerCount: 1, billDate: today, items: [], createdAt: new Date().toISOString() });
	bills.activeId = id;
}

export function removeBill(id: string) {
	const idx = bills.list.findIndex((b) => b.id === id);
	if (idx !== -1) bills.list.splice(idx, 1);
	if (bills.activeId === id) {
		bills.activeId = bills.list[0]?.id ?? null;
	}
}

export function renameBill(id: string, name: string) {
	const b = bills.list.find((b) => b.id === id);
	if (b) b.name = name;
}

export function addToActiveBill(product: Product) {
	const b = activeBill();
	if (!b) return;
	const existing = b.items.find((i) => i.product.id === product.id);
	if (existing) {
		existing.qty++;
	} else {
		b.items.push({ product, qty: 1 });
	}
}

export function updateQty(billId: string, productId: string, delta: number) {
	const b = bills.list.find((b) => b.id === billId);
	if (!b) return;
	const item = b.items.find((i) => i.product.id === productId);
	if (!item) return;
	item.qty += delta;
	if (item.qty <= 0) {
		const idx = b.items.findIndex((i) => i.product.id === productId);
		b.items.splice(idx, 1);
	}
}

export function billTotal(bill: Bill) {
	return bill.items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
}

export function checkout(bill: Bill, paid: number): Transaction {
	const total = billTotal(bill);
	const tx: Transaction = {
		id: Date.now().toString(),
		billName: bill.name,
		customerCount: bill.customerCount,
		items: bill.items.map((i) => ({ ...i })),
		total,
		paid,
		change: paid - total,
		date: new Date(bill.billDate ?? new Date().toLocaleDateString('sv-SE')).toISOString()
	};
	transactions.list.unshift(tx);
	localStorage.setItem('pos_transactions', JSON.stringify(transactions.list));
	removeBill(bill.id);
	return tx;
}

export function deleteTransaction(id: string) {
	const idx = transactions.list.findIndex((t) => t.id === id);
	if (idx !== -1) {
		transactions.list.splice(idx, 1);
		localStorage.setItem('pos_transactions', JSON.stringify(transactions.list));
	}
}

export function saveProducts() {
	localStorage.setItem('pos_products', JSON.stringify(products.list));
}

export function moveProduct(index: number, direction: -1 | 1) {
	const target = index + direction;
	if (target < 0 || target >= products.list.length) return;
	const tmp = products.list[index];
	products.list[index] = products.list[target];
	products.list[target] = tmp;
	saveProducts();
}

export function dailySummary(dateStr: string) {
	const txs = transactions.list.filter(
		(t) => new Date(t.date).toDateString() === new Date(dateStr).toDateString()
	);
	const totalSales = txs.reduce((s, t) => s + t.total, 0);
	const customerCount = txs.reduce((s, t) => s + (t.customerCount ?? 1), 0);
	const avgPerCustomer = customerCount > 0 ? Math.round(totalSales / customerCount) : 0;

	const itemMap = new Map<string, { name: string; qty: number; amount: number }>();
	for (const tx of txs) {
		for (const item of tx.items) {
			const key = item.product.id;
			const existing = itemMap.get(key);
			if (existing) {
				existing.qty += item.qty;
				existing.amount += item.product.price * item.qty;
			} else {
				itemMap.set(key, {
					name: item.product.name,
					qty: item.qty,
					amount: item.product.price * item.qty
				});
			}
		}
	}
	const itemBreakdown = Array.from(itemMap.values()).sort((a, b) => b.amount - a.amount);

	return { txs, totalSales, customerCount, avgPerCustomer, itemBreakdown };
}
