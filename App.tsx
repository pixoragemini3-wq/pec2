import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Product, CartItem, ProductCategory, CartItemVariant } from './types';
import { PRODUCTS } from './constants';
import Header from './components/Header';
import Hero from './components/Hero';
import CategoryNav, { CATEGORY_LABELS } from './components/CategoryNav';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import CartModal from './components/CartModal';
import FloatingCartBar from './components/FloatingCartBar';
import Footer from './components/Footer';
import ContactInfo from './components/ContactInfo';
import SearchBar from './components/SearchBar';
import AdminPanel from './components/AdminPanel';
import CheckoutModal from './components/CheckoutModal';
import UserAccountModal from './components/UserAccountModal';
import LegalModal from './components/LegalModal';
import AnimatedBurgerIcon from './components/icons/animated/AnimatedBurgerIcon';
import AnimatedPigIcon from './components/icons/animated/AnimatedPigIcon';
import AnimatedDrinkIcon from './components/icons/animated/AnimatedDrinkIcon';
import AnimatedChickenIcon from './components/icons/animated/AnimatedChickenIcon';
import AnimatedVeggyIcon from './components/icons/animated/AnimatedVeggyIcon';
import AnimatedKidsIcon from './components/icons/animated/AnimatedKidsIcon';
import AnimatedBoxIcon from './components/icons/animated/AnimatedBoxIcon';
import AnimatedChipsIcon from './components/icons/animated/AnimatedChipsIcon';
import AnimatedStarterIcon from './components/icons/animated/AnimatedStarterIcon';
import AnimatedDessertIcon from './components/icons/animated/AnimatedDessertIcon';
import AnimatedCalendarIcon from './components/icons/animated/AnimatedCalendarIcon';
import AnimatedSauceIcon from './components/icons/animated/AnimatedSauceIcon';
import { useAuth } from './context/auth-context';
import { useCart } from './context/cart-context';
import { authService } from './services/authService';
import { productService } from './services/productService';
import { settingsService, AppSettings } from './services/settingsService';
import { VISITOR_LOGGER_URL } from './config/visitorLogger';

const categoryIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  'panini-del-mese': AnimatedCalendarIcon,
  hamburger: AnimatedBurgerIcon,
  'american-sandwich': AnimatedBurgerIcon,
  'sandwich-maiale': AnimatedPigIcon,
  'sandwich-pollo': AnimatedChickenIcon,
  veggy: AnimatedVeggyIcon,
  'kids-junior': AnimatedKidsIcon,
  box: AnimatedBoxIcon,
  chips: AnimatedChipsIcon,
  starter: AnimatedStarterIcon,
  dolci: AnimatedDessertIcon,
  salse: AnimatedSauceIcon,
  drink: AnimatedDrinkIcon,
};

const categoryAnimations: Record<string, string> = {
  'panini-del-mese': 'animate-jiggle',
  hamburger: 'animate-jiggle',
  'american-sandwich': 'animate-pulse-slow',
  'sandwich-maiale': 'animate-jiggle',
  'sandwich-pollo': 'animate-pulse-slow',
  veggy: 'animate-pulse-slow',
  'kids-junior': 'animate-jiggle',
  box: 'animate-pulse-slow',
  chips: 'animate-jiggle',
  starter: 'animate-pulse-slow',
  dolci: 'animate-jiggle',
  salse: 'animate-pulse-slow',
  drink: 'animate-pulse-slow',
};


const App: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { 
    cartItems, 
    cartCount, 
    totalPrice,
    addToCart, 
    updateQuantity, 
    removeFromCart, 
    clearCart
  } = useCart();
  
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [loading, setLoading] = useState(false);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [showFloatingCart, setShowFloatingCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<CartItemVariant>('panino');
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('panini-del-mese');
  const [isCartAnimating, setIsCartAnimating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({ isOpen: false, type: 'privacy' });
  const [showMondayNotice, setShowMondayNotice] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({ mobileColumns: 2, desktopColumns: 4 });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number>(0);
  const cartTimerRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleCheckout = useCallback(async () => {
    if (!user) {
      try {
        await authService.signInWithGoogle();
        // The effect in AuthContext will update 'user' and the modal can be opened
        // However, since handleCheckout is called in THIS turn, user might still be null.
        // We'll rely on the user being updated and the next click working, 
        // OR we can wait for the profile/user to be populated.
        return;
      } catch (error) {
        console.error("Login fallito:", error);
        alert("Devi accedere per continuare l'ordine.");
        return;
      }
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, [user]);

  const handleOrderSuccess = useCallback((orderId: string) => {
    setIsCheckoutOpen(false);
    alert('Ordine inviato con successo! Numero ordine: ' + orderId);
    setIsAccountOpen(true); // Show orders history
  }, []);

  const fetchProducts = useCallback(async () => {
    // Only show loading if we have no products yet
    if (products.length === 0) setLoading(true);
    try {
      const data = await productService.getProducts();
      // Se abbiamo dati in Firestore, usiamoli sempre (anche se la lista è vuota dopo eliminazioni)
      // Usiamo PRODUCTS come fallback solo se productService.getProducts() fallisce o se è il primo avvio assoluto
      if (data.length === 0 && PRODUCTS.length > 0) {
        if (isAdmin) {
          console.log("Firestore empty and user is admin, seeding with initial products...");
          const success = await productService.seedProducts(PRODUCTS);
          if (success) {
            const seededData = await productService.getProducts();
            setProducts(seededData);
          } else {
            setProducts(PRODUCTS);
          }
        } else {
          console.log("Firestore empty, using fallback constants (only admins can seed).");
          setProducts(PRODUCTS);
        }
      } else {
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts(PRODUCTS); // Fallback on error only
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchProducts();
    
    // Sottoscriviti ai settaggi
    const unsubscribe = settingsService.subscribeToSettings((settings) => {
      setAppSettings(settings);
    });
    
    return () => unsubscribe();
  }, [fetchProducts]);

  useEffect(() => {
    const logVisit = () => {
        if (!VISITOR_LOGGER_URL || VISITOR_LOGGER_URL.includes('INCOLLA_QUI')) {
            console.warn("URL per il logging delle visite non configurato. Salto la registrazione.");
            return;
        }
        try {
            const thirtyMinutes = 30 * 60 * 1000;
            const lastVisit = localStorage.getItem('paneECaffeLastVisit');
            const now = new Date().getTime();
            if (lastVisit && (now - parseInt(lastVisit, 10)) < thirtyMinutes) {
                return;
            }
            fetch(VISITOR_LOGGER_URL, {
                method: 'POST',
                mode: 'no-cors'
            }).catch(error => {});
            localStorage.setItem('paneECaffeLastVisit', now.toString());
        } catch (error) {
            console.error("Errore durante la registrazione della visita:", error);
        }
    };
    logVisit();

    // Check for /admin route
    if (window.location.pathname.includes('/admin')) {
      setIsAdminOpen(true);
      // Clean up URL without reloading
      window.history.replaceState({}, '', window.location.pathname.replace('/admin', ''));
    }
  }, []);

  useEffect(() => {
    try {
      const visibilityMap = products.reduce((acc, p) => {
        acc[p.id] = p.isVisible !== false;
        return acc;
      }, {} as Record<string | number, boolean>);
      localStorage.setItem('paneECaffeProductVisibility', JSON.stringify(visibilityMap));
    } catch (error) {
      console.error("Could not save product visibility to localStorage", error);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('paneECaffeCart', JSON.stringify(cartItems));
    } catch (error) {
      console.error("Could not save cart to localStorage", error);
    }
  }, [cartItems]);

  const filteredProducts = useMemo(() => {
    const currentDay = new Date().getDay();
    const isMonday = currentDay === 1;
    
    const visibleProducts = products.filter(p => {
      if (p.isVisible === false) return false;
      // On Monday (closed) we show everything for consultation.
      // On other days we hide items based on availability.
      if (!isMonday && p.availableDays && !p.availableDays.includes(currentDay)) return false;
      return true;
    });
    if (!searchQuery.trim()) {
        return visibleProducts;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return visibleProducts.filter(p => 
        p.name.toLowerCase().includes(lowerCaseQuery) ||
        p.description.toLowerCase().includes(lowerCaseQuery) ||
        (p.ingredients && p.ingredients.some(i => i.toLowerCase().includes(lowerCaseQuery)))
    );
  }, [searchQuery, products]);


  const productsByCategory = useMemo(() => {
    return filteredProducts.reduce((acc, product) => {
      const category = product.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [filteredProducts]);

  const orderedCategories = useMemo(() => {
    const order: ProductCategory[] = ['panini-del-mese', 'hamburger', 'american-sandwich', 'sandwich-maiale', 'sandwich-pollo', 'veggy', 'kids-junior', 'box', 'chips', 'starter', 'dolci', 'salse', 'drink'];
    return order.filter(cat => productsByCategory[cat] && productsByCategory[cat].length > 0);
  }, [productsByCategory]);

  useEffect(() => {
    const observer = new IntersectionObserver(
        (entries) => {
            if (isScrollingRef.current) return;

            const visibleEntries = entries.filter(entry => entry.isIntersecting);

            if (visibleEntries.length > 0) {
                visibleEntries.sort((a, b) => {
                    return a.boundingClientRect.top - b.boundingClientRect.top;
                });
                
                setActiveCategory(visibleEntries[0].target.id as ProductCategory);
            }
        },
        { 
          rootMargin: '-100px 0px -40% 0px', 
          threshold: 0.01 
        }
    );

    orderedCategories.forEach(cat => {
        const section = sectionRefs.current[cat];
        if (section) {
            observer.observe(section);
        }
    });

    return () => {
        orderedCategories.forEach(cat => {
            const section = sectionRefs.current[cat];
            if (section) {
                observer.unobserve(section);
            }
        });
    };
  }, [orderedCategories]);

  const handleSelectCategory = useCallback((category: ProductCategory | 'contatti') => {
    isScrollingRef.current = true;
    const targetId = category;

    if (category !== 'contatti') {
        setActiveCategory(category as ProductCategory);
    }

    setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false;
    }, 1000);
  }, []);


  useEffect(() => {
      return () => {
          clearTimeout(scrollTimeoutRef.current);
          clearTimeout(cartTimerRef.current);
      };
  }, []);

  const handleToggleProductVisibility = useCallback(async (productId: number | string) => {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product) return;

    try {
      const updated = await productService.updateProduct(productId, { isVisible: !product.isVisible });
      setProducts(prevProducts => prevProducts.map(p => 
        String(p.id) === String(productId) ? { ...p, isVisible: updated?.isVisible ?? !product.isVisible } : p
      ));
    } catch (error) {
      console.error("Error updating visibility:", error);
    }
  }, [products]);

  const handleCloseAdmin = useCallback(() => {
    setIsAdminOpen(false);
  }, []);

  const handleAddToCart = useCallback((item: Omit<CartItem, 'id' | 'quantity'>, quantity: number) => {
    const currentDay = new Date().getDay();
    if (currentDay === 1) {
        setShowMondayNotice(true);
        return;
    }

    addToCart({ ...item, quantity });

    setIsCartAnimating(true);
    setTimeout(() => setIsCartAnimating(false), 500);

    // Gestione visibilità barra flottante (10 secondi)
    setShowFloatingCart(true);
    if (cartTimerRef.current) {
        window.clearTimeout(cartTimerRef.current);
    }
    cartTimerRef.current = window.setTimeout(() => {
        setShowFloatingCart(false);
    }, 10000);
  }, [addToCart]);
  
  const handleUpdateCartQuantity = useCallback((itemId: string, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
  }, [updateQuantity]);

  const handleRemoveFromCart = useCallback((itemId: string) => {
    removeFromCart(itemId);
  }, [removeFromCart]);

  const handleClearCart = useCallback(() => {
    clearCart();
  }, [clearCart]);

  const [selectedMode, setSelectedMode] = useState<'quick-menu' | 'full-customize'>('full-customize');

  const handleViewDetails = useCallback((product: Product, initialVariant: CartItemVariant = 'panino', mode: 'quick-menu' | 'full-customize' = 'full-customize') => {
    setSelectedProduct(product);
    setSelectedVariant(initialVariant);
    setSelectedMode(mode);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
  }, []);
  
  const handleCartClick = useCallback(() => {
    setIsCartOpen(prev => !prev);
  }, []);

  const handleToggleSearch = useCallback(() => {
    setIsSearchActive(prev => {
        const nextState = !prev;
        if (nextState) {
            // When activating search, scroll to the nav bar and focus the input
            const navElement = document.getElementById('category-nav-container');
            if (navElement) {
                navElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            // Delay focus slightly to allow for CSS transition
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 300); // Should match the transition duration
        } else {
            // When deactivating, clear the query
            setSearchQuery('');
        }
        return nextState;
    });
  }, []);

  const handleScrollToTop = useCallback(() => {
    isScrollingRef.current = true;
    setActiveCategory('panini-del-mese');

    setTimeout(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, 0);

    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
    }, 1000);
  }, []);

  
  useEffect(() => {
      if (isCartOpen || selectedProduct || isCheckoutOpen || isAccountOpen || isAdminOpen || legalModal.isOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = 'auto';
      }
      return () => {
          document.body.style.overflow = 'auto';
      };
  }, [isCartOpen, selectedProduct, isCheckoutOpen, isAccountOpen, isAdminOpen, legalModal.isOpen]);

  return (
    <div className="bg-brand-cream text-brand-dark min-h-screen font-sans">
      <Header 
        cartItemCount={cartCount} 
        onCartClick={handleCartClick} 
        onScrollToTop={handleScrollToTop}
        onAdminClick={() => setIsAdminOpen(true)}
        onUserClick={() => setIsAccountOpen(true)}
        isCartAnimating={isCartAnimating}
      />
      <main>
        {!isSearchActive && <Hero />}
        <div id="category-nav-container" className="sticky top-[calc(80px+env(safe-area-inset-top))] md:top-[calc(110px+env(safe-area-inset-top))] z-30 bg-[#f0f0e8]/95 backdrop-blur-sm shadow-sm border-b border-brand-red/10">
            <CategoryNav
                categories={orderedCategories}
                activeCategory={activeCategory}
                onSelectCategory={handleSelectCategory}
                onSearchClick={handleToggleSearch}
            />
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isSearchActive ? 'max-h-40' : 'max-h-0'}`}>
              <div className="container mx-auto px-4">
                  <SearchBar ref={searchInputRef} query={searchQuery} onQueryChange={setSearchQuery} />
              </div>
            </div>
        </div>
        <div className="container mx-auto px-4 py-8 pt-4 space-y-16">
            {loading ? (
                <div className="space-y-16">
                    {[1].map((section) => (
                        <div key={section} className="animate-pulse">
                            <div className="h-10 w-48 bg-gray-200 rounded-md mb-8"></div>
                            <div className={`grid gap-3 md:gap-6 ${
                                appSettings.mobileColumns === 1 
                                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                                : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                            }`}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                    <div key={i} className="bg-white rounded-lg overflow-hidden shadow-md flex flex-col h-full border border-gray-100">
                                        <div className="w-full h-32 md:h-64 bg-gray-200"></div>
                                        <div className="p-3 space-y-3 flex-grow bg-gray-50/50">
                                            <div className="h-6 w-3/4 bg-gray-200 rounded"></div>
                                            <div className="space-y-2">
                                                <div className="h-3 w-full bg-gray-200 rounded"></div>
                                                <div className="h-3 w-5/6 bg-gray-200 rounded"></div>
                                            </div>
                                            <div className="mt-auto pt-4 flex gap-2">
                                                <div className="h-10 flex-1 bg-gray-200 rounded"></div>
                                                <div className="h-10 flex-1 bg-gray-200 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : orderedCategories.length > 0 ? (
                orderedCategories.map(category => {
                    const Icon = categoryIcons[category];
                    const animationClass = categoryAnimations[category] || '';
                    const isSimpleCategory = category === 'salse' || category === 'drink';
                    const isMonthlySpecial = category === 'panini-del-mese';
                    return (
                        <section 
                            key={category} 
                            id={category} 
                            ref={el => { sectionRefs.current[category] = el; }}
                            className="scroll-mt-[136px] md:scroll-mt-[166px]"
                        >
                            <div className={isMonthlySpecial ? 'bg-white p-4 md:p-6 rounded-2xl shadow-xl border-2 border-brand-red/20 relative overflow-hidden' : ''}>
                                <h2 className={`text-3xl md:text-4xl font-bebas tracking-wide uppercase mb-6 border-b-2 pb-2 flex items-center gap-3 relative z-10 ${isMonthlySpecial ? 'text-brand-red border-brand-red/20' : 'text-brand-red border-brand-red/10'}`}>
                                    {Icon && <Icon className={`h-8 w-8 md:h-10 md:w-10 ${animationClass} text-brand-red`} />}
                                    <span>{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}</span>
                                </h2>
                                <div className={`grid gap-3 md:gap-6 relative z-10 ${
                                    appSettings.mobileColumns === 1 
                                    ? (isSimpleCategory ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
                                    : (isSimpleCategory ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
                                }`}>
                                    {(productsByCategory[category] || []).map(product => (
                                        <ProductCard 
                                            key={product.id} 
                                            product={product} 
                                            onAddToCart={handleAddToCart} 
                                            onViewDetails={handleViewDetails}
                                            isSpecial={isMonthlySpecial}
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>
                    )
                })
            ) : (
                <div className="text-center py-16">
                    <p className="text-2xl font-bold text-gray-400">Nessun prodotto trovato</p>
                    <p className="text-gray-500 mt-2">Prova a modificare i termini della tua ricerca.</p>
                </div>
            )}
        </div>
        <ContactInfo />
      </main>
      <Footer onOpenLegal={(type) => setLegalModal({ isOpen: true, type })} />
      {selectedProduct && (
        <ProductModal 
            product={selectedProduct}
            onClose={handleCloseModal}
            onAddToCart={handleAddToCart}
            initialVariant={selectedVariant}
            mode={selectedMode}
        />
      )}
      {isCartOpen && (
        <CartModal
            isOpen={isCartOpen}
            onClose={handleCartClick}
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onCheckout={handleCheckout}
        />
      )}
      {isCheckoutOpen && (
        <CheckoutModal 
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={handleOrderSuccess}
        />
      )}
      {isAccountOpen && (
        <UserAccountModal 
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
        />
      )}
      <FloatingCartBar 
        itemCount={cartCount} 
        totalPrice={totalPrice} 
        onClick={handleCartClick} 
        isAnimating={isCartAnimating}
        isVisible={showFloatingCart && !isCartOpen}
      />
      {isAdminOpen && (
        <AdminPanel 
          products={products} 
          onToggleVisibility={handleToggleProductVisibility}
          onRefresh={fetchProducts}
          onClose={handleCloseAdmin}
        />
      )}

      <LegalModal 
        isOpen={legalModal.isOpen}
        onClose={() => setLegalModal(prev => ({ ...prev, isOpen: false }))}
        type={legalModal.type}
      />

      {/* Monday Closure Notice */}
      {showMondayNotice && (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowMondayNotice(false)}
        >
            <div 
                className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center transform transition-all animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🗓️</span>
                </div>
                <h3 className="text-2xl font-bebas tracking-wide text-brand-red mb-2">Siamo Chiusi</h3>
                <p className="text-brand-dark mb-6 leading-relaxed">
                    Il lunedì il nostro staff si riposa! Riprendiamo gli ordini da martedì. Puoi comunque consultare il menù.
                </p>
                <button 
                    onClick={() => setShowMondayNotice(false)}
                    className="w-full py-3 bg-brand-red text-white font-bebas tracking-widest text-xl rounded-xl hover:bg-brand-red/90 transition-colors shadow-lg active:scale-95"
                >
                    Ho Capito
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;