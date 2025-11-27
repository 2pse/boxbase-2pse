import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Loader2, Link as LinkIcon, Upload, X } from "lucide-react";
import { ShopProduct } from "@/types/shop";
import { Badge } from "@/components/ui/badge";

export const ProductManager = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkingStripe, setLinkingStripe] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    stock_quantity: "",
    image_url: "",
    is_active: true,
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shop_products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading products:", error);
      toast.error("Error loading products");
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "",
      stock_quantity: "",
      image_url: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (product: ShopProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      category: product.category || "",
      stock_quantity: product.stock_quantity.toString(),
      image_url: product.image_url || "",
      is_active: product.is_active,
    });
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("shop-products")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Error uploading image");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("shop-products")
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
      toast.success("Image uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image_url: "" });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    setSaving(true);

    const productData = {
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      category: formData.category || null,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      image_url: formData.image_url || null,
      is_active: formData.is_active,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("shop_products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        console.error("Error updating product:", error);
        toast.error("Error updating product");
      } else {
        toast.success("Product updated");
        setDialogOpen(false);
        loadProducts();
      }
    } else {
      const { data, error } = await supabase
        .from("shop_products")
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.error("Error creating product:", error);
        toast.error("Error creating product");
      } else {
        toast.success("Product created");
        setDialogOpen(false);
        loadProducts();

        // Auto-create Stripe product
        if (data) {
          await linkToStripe(data.id);
        }
      }
    }

    setSaving(false);
  };

  const handleDelete = async (product: ShopProduct) => {
    if (!confirm(`Do you really want to delete "${product.name}"?`)) return;

    const { error } = await supabase
      .from("shop_products")
      .delete()
      .eq("id", product.id);

    if (error) {
      console.error("Error deleting product:", error);
      toast.error("Error deleting product");
    } else {
      toast.success("Product deleted");
      loadProducts();
    }
  };

  const linkToStripe = async (productId: string) => {
    setLinkingStripe(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Not logged in");
      setLinkingStripe(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("create-stripe-shop-product", {
      body: { product_id: productId },
    });

    if (error) {
      console.error("Stripe linking error:", error);
      toast.error("Stripe linking failed");
    } else if (data?.error) {
      toast.error(data.error);
    } else {
      toast.success("Linked to Stripe");
      loadProducts();
    }

    setLinkingStripe(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Shop Products</h2>
          <p className="text-muted-foreground">Manage your shop products</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Product
        </Button>
      </div>

      {products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No products yet</p>
            <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
              Create first product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className={!product.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {product.name}
                      {product.stock_quantity === 0 && (
                        <Badge variant="destructive" className="text-xs">
                          Sold Out
                        </Badge>
                      )}
                    </CardTitle>
                    {product.category && (
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(product)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.image_url && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-lg">{product.price.toFixed(2)} €</span>
                  <span className="text-muted-foreground">
                    Stock: {product.stock_quantity}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  {product.stripe_product_id ? (
                    <Badge variant="outline" className="text-xs">
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Stripe linked
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => linkToStripe(product.id)}
                      disabled={linkingStripe}
                    >
                      {linkingStripe ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3 w-3 mr-1" />
                      )}
                      Link to Stripe
                    </Button>
                  )}
                  
                  {!product.is_active && (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (€) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Apparel, Equipment, Supplements..."
              />
            </div>

            <div className="space-y-2">
              <Label>Product Image</Label>
              {formData.image_url ? (
                <div className="relative">
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={formData.image_url}
                      alt="Product image"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG up to 5MB
                      </p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active (visible in shop)</Label>
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
