export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">載入中...</p>
      </div>
    </div>
  )
}
