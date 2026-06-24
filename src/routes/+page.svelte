<script lang="ts">
	import {
		products, transactions,
		bills, activeBill, newBill, removeBill, renameBill,
		addToActiveBill, updateQty, billTotal, checkout, saveProducts, moveProduct,
		deleteTransaction, dailySummary,
		type Transaction
	} from '$lib/store.svelte';

	let tab = $state<'register' | 'products' | 'report'>('register');
	let paidInput = $state('');
	let receipt = $state<Transaction | null>(null);
	let showReceipt = $state(false);
	let editingBillId = $state<string | null>(null);
	let editingBillName = $state('');

	let newName = $state('');
	let newPrice = $state('');
	let newCategory = $state('');

	const categories = $derived([...new Set(products.list.map((p) => p.category))]);
	const filterCat = $state({ value: 'すべて' });
	const filtered = $derived(
		filterCat.value === 'すべて'
			? products.list
			: products.list.filter((p) => p.category === filterCat.value)
	);

	function handleCheckout() {
		const bill = activeBill();
		if (!bill) return;
		const paid = Number(paidInput);
		if (isNaN(paid) || paid < billTotal(bill)) return;
		receipt = checkout(bill, paid);
		showReceipt = true;
		paidInput = '';
	}

	function startRename(id: string, currentName: string) {
		editingBillId = id;
		editingBillName = currentName;
	}

	function commitRename() {
		if (editingBillId && editingBillName.trim()) renameBill(editingBillId, editingBillName.trim());
		editingBillId = null;
	}

	function addProduct() {
		if (!newName || !newPrice) return;
		products.list.push({
			id: Date.now().toString(),
			name: newName,
			price: parseInt(newPrice),
			category: newCategory || 'その他'
		});
		saveProducts();
		newName = ''; newPrice = ''; newCategory = '';
	}

	function deleteProduct(id: string) {
		const idx = products.list.findIndex((p) => p.id === id);
		if (idx !== -1) { products.list.splice(idx, 1); saveProducts(); }
	}

	let dragFromIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function onDragStart(i: number) {
		dragFromIndex = i;
	}
	function onDragOver(e: DragEvent, i: number) {
		e.preventDefault();
		dragOverIndex = i;
	}
	function onDrop(i: number) {
		if (dragFromIndex === null || dragFromIndex === i) return;
		const item = products.list.splice(dragFromIndex, 1)[0];
		products.list.splice(i, 0, item);
		saveProducts();
		dragFromIndex = null;
		dragOverIndex = null;
	}
	function onDragEnd() {
		dragFromIndex = null;
		dragOverIndex = null;
	}

	const reportDate = $state({ value: new Date().toISOString().slice(0, 10) });
	const summary = $derived(dailySummary(reportDate.value));

	function fmt(n: number) { return n.toLocaleString('ja-JP'); }
	function fmtDate(iso: string) { return new Date(iso).toLocaleString('ja-JP'); }

	const current = $derived(activeBill());
	const currentTotal = $derived(current ? billTotal(current) : 0);
</script>

<svelte:head>
	<style>
		@media print {
			body * { visibility: hidden; }
			#print-area, #print-area * { visibility: visible; }
			#print-area { position: fixed; top: 0; left: 0; width: 100%; }
		}
	</style>
</svelte:head>

<div class="min-h-screen bg-gray-100 flex flex-col">
	<header class="bg-teal-700 text-white px-6 py-3 flex items-center justify-between shadow">
		<h1 class="text-lg font-bold tracking-wide">POSレジ</h1>
		<nav class="flex gap-1">
			{#each [['register','レジ'],['products','商品管理'],['report','売上']] as [key, label]}
				<button
					onclick={() => tab = key as any}
					class="px-4 py-1.5 rounded-md text-sm font-medium transition {tab === key ? 'bg-white text-teal-700' : 'text-teal-100 hover:bg-teal-600'}"
				>{label}</button>
			{/each}
		</nav>
	</header>

	<!-- レジ画面 -->
	{#if tab === 'register'}
	<div class="flex flex-1 overflow-hidden">
		<div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
			<!-- 伝票タブバー -->
			<div class="flex items-center gap-2 flex-wrap">
				{#each bills.list as bill}
					<div class="flex items-center rounded-lg border-2 transition {bills.activeId === bill.id ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-gray-200 text-gray-700'}">
						<button onclick={() => bills.activeId = bill.id} class="px-3 py-1.5 text-sm font-medium">
							{#if editingBillId === bill.id}
								<input
									class="bg-transparent border-b border-white outline-none w-24 text-sm"
									bind:value={editingBillName}
									onblur={commitRename}
									onkeydown={(e) => e.key === 'Enter' && commitRename()}
									autofocus
									onclick={(e) => e.stopPropagation()}
								/>
							{:else}
								<span ondblclick={() => startRename(bill.id, bill.name)}>{bill.name}</span>
							{/if}
						</button>
						<button onclick={() => removeBill(bill.id)} class="pr-2 opacity-40 hover:opacity-100 text-xs">✕</button>
					</div>
				{/each}
				<button
					onclick={newBill}
					class="px-3 py-1.5 rounded-lg border-2 border-dashed border-teal-300 text-teal-600 text-sm hover:border-teal-500 hover:bg-teal-50 transition"
				>＋ 新しい伝票</button>
			</div>

			{#if !current}
				<div class="flex-1 flex items-center justify-center text-gray-400">
					<p>「新しい伝票」をタップして始めてください</p>
				</div>
			{:else}
				<div class="flex gap-2 flex-wrap">
					{#each ['すべて', ...categories] as cat}
						<button
							onclick={() => filterCat.value = cat}
							class="px-3 py-1 rounded-md text-sm border transition {filterCat.value === cat ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'}"
						>{cat}</button>
					{/each}
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1">
					{#each filtered as product}
						<button
							onclick={() => addToActiveBill(product)}
							class="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:border-teal-400 hover:shadow transition text-left active:scale-95"
						>
							<div class="font-semibold text-gray-800 mb-1">{product.name}</div>
							<div class="text-xs text-gray-400 mb-2">{product.category}</div>
							<div class="text-teal-700 font-bold text-lg">¥{fmt(product.price)}</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 右：伝票 -->
		<div class="w-80 bg-white border-l flex flex-col">
			{#if !current}
				<div class="flex-1 flex items-center justify-center text-gray-300 text-sm">伝票を選択してください</div>
			{:else}
				<!-- 伝票名 -->
				<div class="px-4 py-3 border-b flex items-center gap-2 bg-gray-50">
					{#if editingBillId === current.id}
						<input
							class="flex-1 border-b-2 border-teal-500 outline-none font-bold text-gray-800 bg-transparent"
							bind:value={editingBillName}
							onblur={commitRename}
							onkeydown={(e) => e.key === 'Enter' && commitRename()}
							autofocus
						/>
					{:else}
						<span class="flex-1 font-bold text-gray-800">{current.name}</span>
						<button onclick={() => startRename(current.id, current.name)} class="text-xs text-gray-400 hover:text-teal-600 border rounded px-2 py-0.5">名前変更</button>
					{/if}
				</div>

				<!-- 客数入力 -->
				<div class="px-4 py-2 border-b flex items-center gap-3 bg-gray-50">
					<span class="text-sm text-gray-600">客数</span>
					<div class="flex items-center gap-2 ml-auto">
						<button
							onclick={() => { if (current.customerCount > 1) current.customerCount--; }}
							class="w-7 h-7 rounded border bg-white text-gray-600 hover:bg-gray-100 text-sm"
						>−</button>
						<span class="w-8 text-center font-bold text-gray-800">{current.customerCount}</span>
						<button
							onclick={() => current.customerCount++}
							class="w-7 h-7 rounded border bg-white text-gray-600 hover:bg-gray-100 text-sm"
						>＋</button>
						<span class="text-sm text-gray-500">名</span>
					</div>
				</div>

				<!-- 商品リスト -->
				<div class="flex-1 overflow-y-auto divide-y">
					{#if current.items.length === 0}
						<p class="text-gray-400 text-center mt-8 text-sm">商品を選んでください</p>
					{/if}
					{#each current.items as item}
						<div class="flex items-center gap-2 px-4 py-2.5">
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium truncate">{item.product.name}</div>
								<div class="text-xs text-gray-400">¥{fmt(item.product.price)}</div>
							</div>
							<div class="flex items-center gap-1">
								<button onclick={() => updateQty(current.id, item.product.id, -1)} class="w-6 h-6 bg-gray-100 rounded text-sm hover:bg-gray-200 border">−</button>
								<span class="w-7 text-center text-sm font-bold">{item.qty}</span>
								<button onclick={() => updateQty(current.id, item.product.id, 1)} class="w-6 h-6 bg-gray-100 rounded text-sm hover:bg-gray-200 border">＋</button>
							</div>
							<div class="text-sm font-bold text-teal-700 w-16 text-right">¥{fmt(item.product.price * item.qty)}</div>
						</div>
					{/each}
				</div>

				<!-- 合計・支払い -->
				<div class="p-4 border-t space-y-3 bg-gray-50">
					<div class="flex justify-between text-xl font-bold">
						<span>合計</span>
						<span class="text-teal-700">¥{fmt(currentTotal)}</span>
					</div>
					<input
						type="number"
						bind:value={paidInput}
						placeholder="受け取り金額"
						class="w-full border rounded-lg px-3 py-2 text-right text-lg"
					/>
					{#if paidInput && Number(paidInput) >= currentTotal && current.items.length > 0}
						<div class="text-right text-sm text-gray-500">
							お釣り: <span class="text-green-600 font-bold text-lg">¥{fmt(Number(paidInput) - currentTotal)}</span>
						</div>
					{/if}
					<button
						onclick={handleCheckout}
						disabled={current.items.length === 0 || !paidInput || Number(paidInput) < currentTotal}
						class="w-full py-3 rounded-lg font-bold text-white text-lg transition {current.items.length > 0 && paidInput && Number(paidInput) >= currentTotal ? 'bg-teal-700 hover:bg-teal-800' : 'bg-gray-300 cursor-not-allowed'}"
					>会計する</button>
				</div>
			{/if}
		</div>
	</div>
	{/if}

	<!-- 商品管理 -->
	{#if tab === 'products'}
	<div class="p-4 max-w-2xl mx-auto w-full">
		<div class="bg-white rounded-lg border p-4 mb-4">
			<h2 class="font-bold text-gray-700 mb-3">新しい商品を追加</h2>
			<div class="grid grid-cols-2 gap-3">
				<input bind:value={newName} class="border rounded-lg px-3 py-2 col-span-2" placeholder="商品名" />
				<input bind:value={newPrice} type="number" class="border rounded-lg px-3 py-2" placeholder="金額（円）" />
				<input bind:value={newCategory} class="border rounded-lg px-3 py-2" placeholder="カテゴリ（例: ドリンク）" />
			</div>
			<button
				onclick={addProduct}
				disabled={!newName || !newPrice}
				class="mt-3 w-full py-2 rounded-lg font-bold text-white transition {newName && newPrice ? 'bg-teal-700 hover:bg-teal-800' : 'bg-gray-300 cursor-not-allowed'}"
			>追加する</button>
		</div>
		<div class="bg-white rounded-lg border divide-y">
			{#each products.list as p, i}
				<div
					draggable="true"
					ondragstart={() => onDragStart(i)}
					ondragover={(e) => onDragOver(e, i)}
					ondrop={() => onDrop(i)}
					ondragend={onDragEnd}
					class="px-4 py-3 flex items-center gap-3 transition-colors {dragOverIndex === i && dragFromIndex !== i ? 'bg-teal-50 border-teal-300' : ''} {dragFromIndex === i ? 'opacity-40' : ''}"
				>
					<span class="text-gray-300 cursor-grab active:cursor-grabbing select-none text-lg">⠿</span>
					<div class="flex-1">
						<div class="font-medium text-gray-800">{p.name}</div>
						<div class="text-xs text-gray-400">{p.category}</div>
					</div>
					<div class="font-bold text-teal-700">¥{fmt(p.price)}</div>
					<button onclick={() => deleteProduct(p.id)} class="text-red-400 hover:text-red-600 text-sm border border-red-200 rounded px-2 py-0.5">削除</button>
				</div>
			{/each}
		</div>
	</div>
	{/if}

	<!-- 売上レポート -->
	{#if tab === 'report'}
	<div class="p-4 max-w-2xl mx-auto w-full">
		<div class="bg-white rounded-lg border p-4 mb-4 flex items-center gap-3">
			<label class="text-sm text-gray-600 font-medium">日付</label>
			<input type="date" bind:value={reportDate.value} class="border rounded-lg px-3 py-1.5 text-sm" />
			<button
				onclick={() => window.print()}
				class="ml-auto px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-bold hover:bg-teal-800 transition"
			>印刷 / PDF出力</button>
		</div>

		<div id="print-area">
			<div class="bg-white rounded-lg border p-6 mb-4">
				<h2 class="text-lg font-bold text-gray-800 mb-1">日次売上レポート</h2>
				<p class="text-sm text-gray-400 mb-5">{new Date(reportDate.value).toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric' })}</p>

				<div class="grid grid-cols-3 gap-4 mb-6">
					<div class="text-center p-4 bg-teal-50 rounded-lg">
						<div class="text-xs text-gray-500 mb-1">総売上</div>
						<div class="text-2xl font-bold text-teal-700">¥{fmt(summary.totalSales)}</div>
					</div>
					<div class="text-center p-4 bg-gray-50 rounded-lg">
						<div class="text-xs text-gray-500 mb-1">客数</div>
						<div class="text-2xl font-bold text-gray-800">{summary.customerCount}<span class="text-base font-normal ml-1">名</span></div>
					</div>
					<div class="text-center p-4 bg-gray-50 rounded-lg">
						<div class="text-xs text-gray-500 mb-1">客単価</div>
						<div class="text-2xl font-bold text-gray-800">¥{fmt(summary.avgPerCustomer)}</div>
					</div>
				</div>

				<h3 class="font-bold text-gray-700 mb-2 text-sm">商品別売上</h3>
				{#if summary.itemBreakdown.length === 0}
					<p class="text-gray-400 text-sm">この日の取引はありません</p>
				{:else}
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-gray-500 text-xs">
								<th class="text-left py-2">商品名</th>
								<th class="text-right py-2">個数</th>
								<th class="text-right py-2">金額</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each summary.itemBreakdown as item}
								<tr>
									<td class="py-2">{item.name}</td>
									<td class="text-right py-2">{item.qty}個</td>
									<td class="text-right py-2 font-medium">¥{fmt(item.amount)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t font-bold">
								<td class="pt-2">合計</td>
								<td class="text-right pt-2">{summary.itemBreakdown.reduce((s,i)=>s+i.qty,0)}個</td>
								<td class="text-right pt-2 text-teal-700">¥{fmt(summary.totalSales)}</td>
							</tr>
						</tfoot>
					</table>
				{/if}
			</div>

			<div class="bg-white rounded-lg border">
				<div class="px-4 py-3 border-b font-bold text-sm text-gray-700">取引一覧</div>
				{#if summary.txs.length === 0}
					<p class="text-gray-400 text-center py-6 text-sm">この日の取引はありません</p>
				{/if}
				{#each summary.txs as tx}
					<div class="px-4 py-3 border-b last:border-0">
						<div class="flex justify-between mb-1">
							<div class="font-medium text-sm">
								{tx.billName}
								<span class="text-xs text-gray-400 ml-2">{tx.customerCount}名</span>
								<span class="text-xs text-gray-400 ml-1">{fmtDate(tx.date)}</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="font-bold text-teal-700 text-sm">¥{fmt(tx.total)}</span>
								<button
									onclick={() => { if (confirm(`「${tx.billName}」の取引を削除しますか？`)) deleteTransaction(tx.id); }}
									class="text-red-400 hover:text-red-600 text-xs border border-red-200 rounded px-1.5 py-0.5"
								>削除</button>
							</div>
						</div>
						<div class="text-xs text-gray-400">{tx.items.map(i => `${i.product.name}×${i.qty}`).join('、')}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
	{/if}
</div>

<!-- レシートモーダル -->
{#if showReceipt && receipt}
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
	<div class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
		<div class="text-center mb-4">
			<h2 class="text-xl font-bold">会計完了</h2>
			<p class="text-gray-500 text-sm mt-1">{receipt.billName}（{receipt.customerCount}名）</p>
		</div>
		<div class="space-y-2 mb-4">
			{#each receipt.items as item}
				<div class="flex justify-between text-sm">
					<span>{item.product.name} × {item.qty}</span>
					<span>¥{fmt(item.product.price * item.qty)}</span>
				</div>
			{/each}
			<div class="border-t pt-2 flex justify-between font-bold">
				<span>合計</span><span>¥{fmt(receipt.total)}</span>
			</div>
			<div class="flex justify-between text-sm text-gray-500">
				<span>お預かり</span><span>¥{fmt(receipt.paid)}</span>
			</div>
			<div class="flex justify-between font-bold text-green-600 text-lg">
				<span>お釣り</span><span>¥{fmt(receipt.change)}</span>
			</div>
		</div>
		<button onclick={() => showReceipt = false} class="w-full py-3 bg-teal-700 text-white rounded-lg font-bold hover:bg-teal-800">閉じる</button>
	</div>
</div>
{/if}
