(function($) {
    'use strict';

    // Plugin configuration and state
    const WSDM = {
        config: {
            shipping_format: 'radio',
            is_blocks_enabled: false
        },
        cache: {
            observers: new WeakMap(),
            timeouts: new Map(),
            convertedPackages: new Set(), // Track converted packages to prevent duplicates
            conversionInProgress: false,  // Prevent multiple simultaneous conversions
            selectChangeInProgress: false // Track when our select changes are happening
        },
        constants: {
            CONVERSION_DELAY: 100,
            SYNC_DEBOUNCE_DELAY: 50,
            BLOCK_SELECTORS: {
                CART: '.wp-block-woocommerce-cart .wc-block-components-radio-control',
                CHECKOUT: '.wp-block-woocommerce-checkout #shipping-option .wc-block-components-radio-control'
            },
            CLASSES: {
                CONVERTED: 'wsdm-converted',
                SHIPPING_SELECT: 'wsdm-shipping-select',
                BLOCK_SELECT: 'wsdm-block-shipping-select',
                PACKAGE_CONVERTED: 'wsdm-package-converted' // Mark converted packages
            }
        }
    };

    // Initialize plugin when DOM is ready
    $(document).ready(function() {
        // Enable debug mode temporarily to help diagnose the issue
        window.wsdm_debug = false;
        
        logDebug('DOM ready, initializing plugin');
        initializePlugin();
        bindEvents();
        
        // Add manual trigger for testing
        window.wsdmForceConversion = function() {
            logDebug('Manual conversion triggered');
            // Clear conversion cache before forcing
            WSDM.cache.convertedPackages.clear();
            WSDM.cache.conversionInProgress = false;
            initializeShippingMethods();
        };
    });

    /**
     * Initialize the plugin
     */
    function initializePlugin() {
        loadConfiguration();
        initializeShippingMethods();
    }

    /**
     * Bind all event listeners
     */
    function bindEvents() {
        // Classic cart/checkout events - handle WooCommerce HTML refreshes
        $('body').on('updated_cart_totals updated_checkout', debounce(function() {
            logDebug('Cart/checkout update event detected');
            
            // If we had select dropdowns before but they're gone now, WooCommerce refreshed the HTML
            const existingSelects = $('.' + WSDM.constants.CLASSES.SHIPPING_SELECT).length;
            const hadConvertedPackages = WSDM.cache.convertedPackages.size > 0;
            const shippingMethods = $('.shipping_method').length;
            
            logDebug('Update check - existingSelects: ' + existingSelects + ', hadConverted: ' + hadConvertedPackages + ', shippingMethods: ' + shippingMethods);
            
            if (hadConvertedPackages && existingSelects === 0 && shippingMethods > 0) {
                logDebug('WooCommerce refreshed HTML - re-converting dropdowns...');
                // Clear the converted packages cache since HTML was refreshed
                WSDM.cache.convertedPackages.clear();
                WSDM.cache.conversionInProgress = false;
                // Re-convert immediately
                setTimeout(function() {
                    WSDM.cache.selectChangeInProgress = false;
                    initializeShippingMethods();
                }, 100);
            } else if (existingSelects === 0 && !hadConvertedPackages && !WSDM.cache.conversionInProgress && shippingMethods > 0) {
                logDebug('Initial conversion needed...');
                initializeShippingMethods();
            } else {
                logDebug('No conversion needed - selects exist or no shipping methods found');
            }
        }, 200));

        // Global event delegation for WSDM select dropdowns as fallback
        $('body').on('change.wsdm', '.' + WSDM.constants.CLASSES.SHIPPING_SELECT, function() {
            logDebug('Global event handler triggered for select: ' + $(this).attr('id'));
            handleShippingSelectChange($(this));
        });

        // Block-based cart/checkout events
        if (isWpDataAvailable()) {
            setupStoreSubscription();
            setupCleanupHandlers();
        }
    }

    /**
     * Set up Store API subscription for blocks
     */
    function setupStoreSubscription() {
        let unsubscribe = null;
        
        const subscribeToStore = () => {
            if (!wp.data.select('wc/store/cart')) {
                return;
            }
            
            unsubscribe = wp.data.subscribe(() => {
                const cart = wp.data.select('wc/store/cart').getCartData();
                if (cart && cart.shippingRates) {
                    debounce(initializeShippingMethods, WSDM.constants.CONVERSION_DELAY)();
                }
            });
        };

        // Subscribe when ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', subscribeToStore);
        } else {
            subscribeToStore();
        }

        // Store cleanup function
        WSDM.cache.unsubscribe = unsubscribe;
    }

    /**
     * Set up cleanup handlers
     */
    function setupCleanupHandlers() {
        window.addEventListener('beforeunload', () => {
            if (WSDM.cache.unsubscribe) {
                WSDM.cache.unsubscribe();
            }
            if (WSDM.cache.mutationObserver) {
                WSDM.cache.mutationObserver.disconnect();
            }
            cleanupObservers();
            clearAllTimeouts();
        });
    }

    /**
     * Load plugin configuration from localized script
     */
    function loadConfiguration() {
        const params = window.wsdm_params || {};
        logDebug('Loading configuration from wsdm_params: ' + JSON.stringify(params));
        
        WSDM.config.shipping_format = sanitizeString(params.shipping_format, 'radio');
        WSDM.config.is_blocks_enabled = Boolean(params.is_blocks_enabled);
        
        logDebug('Final config - shipping_format: ' + WSDM.config.shipping_format + ', is_blocks_enabled: ' + WSDM.config.is_blocks_enabled);
        
        // Maintain legacy global for backward compatibility
        window.wsdmConfig = WSDM.config;
        
        // If configuration is not 'select', provide a way to force it for testing
        if (WSDM.config.shipping_format !== 'select') {
            logDebug('WARNING: shipping_format is not set to "select". Current value: ' + WSDM.config.shipping_format);
            logDebug('To test select mode, use: window.wsdmShippingDisplayMode.debug.forceSelectMode()');
        }
    }

    /**
     * Global handler for shipping select changes (fallback)
     */
    function handleShippingSelectChange($select) {
        const selectedValue = $select.val();
        const packageIndex = $select.data('package-index') || 0;
        
        logDebug('Handling select change - preventing HTML refresh');
        WSDM.cache.selectChangeInProgress = true;
        
        // Store current state before triggering WooCommerce update
        const currentPackages = new Set(WSDM.cache.convertedPackages);
        
        // Find corresponding hidden radios
        const $wrapper = $select.closest('.wsdm-shipping-wrapper');
        const $hiddenRadios = $wrapper.find('.wsdm-hidden-shipping-radios');
        
        if ($hiddenRadios.length) {
            const $hiddenRadio = $hiddenRadios.find('input[value="' + selectedValue + '"]');
            if ($hiddenRadio.length) {
                $hiddenRadios.find('input[type="radio"]').prop('checked', false);
                $hiddenRadio.prop('checked', true);
                
                // Trigger change directly without using jQuery trigger to avoid interference
                const event = new Event('change', { bubbles: true });
                $hiddenRadio[0].dispatchEvent(event);
                
                logDebug('Global handler updated hidden radio for package ' + packageIndex);
            }
        }
        
        // Use a more direct approach for WooCommerce updates
        const $form = $select.closest('form');
        if ($form.length && ($form.hasClass('checkout') || $form.attr('name') === 'checkout')) {
            // For checkout, trigger the specific update
            $('body').trigger('update_checkout');
        } else {
            // For cart, trigger cart totals update
            $('body').trigger('updated_cart_totals');
        }
        
        // Set up monitoring for HTML refresh and immediate re-conversion
        let checkCount = 0;
        const checkInterval = setInterval(function() {
            checkCount++;
            const selectsExist = $('.' + WSDM.constants.CLASSES.SHIPPING_SELECT).length > 0;
            
            if (!selectsExist && checkCount < 20) {
                logDebug('Select dropdowns disappeared, re-converting immediately...');
                WSDM.cache.convertedPackages = currentPackages;
                WSDM.cache.conversionInProgress = false;
                initializeShippingMethods();
                clearInterval(checkInterval);
            } else if (checkCount >= 20) {
                clearInterval(checkInterval);
            }
        }, 50);
        
        // Clear the flag after sufficient delay
        setTimeout(function() {
            WSDM.cache.selectChangeInProgress = false;
            clearInterval(checkInterval);
            logDebug('Cleared selectChangeInProgress flag');
        }, 2000);
    }

    /**
     * Initialize shipping method conversion
     */
    function initializeShippingMethods() {
        logDebug('Initializing shipping methods. Config format: ' + WSDM.config.shipping_format);
        logDebug('Blocks enabled: ' + WSDM.config.is_blocks_enabled);
        
        // Prevent multiple simultaneous conversions
        if (WSDM.cache.conversionInProgress) {
            logDebug('Conversion already in progress, skipping...');
            return;
        }
        
        if (WSDM.config.shipping_format === 'select') {
            logDebug('Starting conversion to select dropdowns');
            WSDM.cache.conversionInProgress = true;
            
            try {
                convertClassicShippingMethods();
                convertBlockShippingMethods();
            } finally {
                // Reset flag after conversion completes
                setTimeout(function() {
                    WSDM.cache.conversionInProgress = false;
                }, 500);
            }
        } else {
            logDebug('Shipping format is not select, skipping conversion');
        }
    }

    /**
     * Convert classic shipping methods to dropdown
     */
    function convertClassicShippingMethods() {
        logDebug('Starting classic shipping methods conversion');
        
        // First check if there are any shipping methods at all
        const $allShippingMethods = $('.shipping_method');
        logDebug('Found ' + $allShippingMethods.length + ' total shipping methods on page');
        
        if ($allShippingMethods.length === 0) {
            logDebug('No shipping methods found, exiting classic conversion');
            return;
        }
        
        // Group shipping methods by package instead of processing all together
        const packageGroups = groupShippingMethodsByPackage();
        logDebug('Detected ' + packageGroups.length + ' package groups');
        
        if (packageGroups.length === 0) {
            logDebug('No package groups detected, exiting classic conversion');
            return;
        }
        
        // Process each package separately
        packageGroups.forEach(function(packageData, index) {
            logDebug('Processing package ' + index + ' with ' + packageData.methods.length + ' methods');
            
            if (shouldConvertClassicPackage(packageData)) {
                logDebug('Converting package ' + index + ' to select dropdown');
                convertPackageToSelect(packageData, index);
            } else {
                logDebug('Package ' + index + ' should not be converted');
            }
        });
    }

    /**
     * Group shipping methods by package
     */
    function groupShippingMethodsByPackage() {
        const packageGroups = [];
        logDebug('Starting package grouping');
        
        const $allMethods = $('.shipping_method');
        if ($allMethods.length === 0) {
            logDebug('No shipping methods found with class .shipping_method');
            return packageGroups;
        }
        
        logDebug('Found ' + $allMethods.length + ' shipping methods total');
        
        // Strategy 1: Look for shipping methods grouped by name attribute (for multiple packages)
        const methodsByName = {};
        $allMethods.each(function() {
            const $method = $(this);
            const nameAttr = $method.attr('name') || 'shipping_method[0]';
            logDebug('Found shipping method with name: ' + nameAttr + ', value: ' + $method.val());
            
            if (!methodsByName[nameAttr]) {
                methodsByName[nameAttr] = [];
            }
            methodsByName[nameAttr].push($method);
        });
        
        logDebug('Methods grouped by name attribute: ' + Object.keys(methodsByName).length + ' groups');
        
        // Convert each name group to a package
        Object.entries(methodsByName).forEach(function([name, methods], index) {
            
            if (methods.length > 0) {
                const $methods = $(methods);
                
                // Find the best container for this package - try multiple selectors
                const $firstMethod = $methods.first()[0];
                
                let $container = null;
                
                // Try different container selectors in order of preference
                const containerSelectors = [
                    '.woocommerce-shipping-methods',
                    'ul.woocommerce-shipping-methods', 
                    '#shipping_method',
                    '.shipping',
                    'table.woocommerce-checkout-review-order-table tbody',
                    '.shop_table tbody',
                    'tbody',
                    'ul',
                    'ol',
                    '.shipping-methods',
                    '[class*="shipping"]',
                    'tr.shipping',
                    'tr'
                ];
                
                logDebug('Trying to find container for first method...');
                logDebug('First method HTML: ' + $firstMethod.prop('outerHTML'));
                logDebug('First method parent: ' + $firstMethod.parent().prop('tagName') + ' (class: ' + $firstMethod.parent().attr('class') + ')');
                
                for (let i = 0; i < containerSelectors.length; i++) {
                    $container = $firstMethod.closest(containerSelectors[i]);
                    if ($container.length) {
                        logDebug('Found container with selector "' + containerSelectors[i] + '": ' + $container.prop('tagName'));
                        break;
                    }
                }
                
                // If still no container found, use the immediate parent
                if (!$container || !$container.length) {
                    logDebug('No specific container found, using immediate parent');
                    $container = $firstMethod.parent();
                    
                    // If parent is a label, go up one more level
                    if ($container.is('label')) {
                        $container = $container.parent();
                        logDebug('Parent was a label, using grandparent: ' + $container.prop('tagName'));
                    }
                }
                
                logDebug('Final container: ' + $container.prop('tagName') + ' (class: ' + $container.attr('class') + ')');
                logDebug('Container HTML preview: ' + $container.prop('outerHTML').substring(0, 200) + '...');
                
                logDebug('Package ' + index + ' - Name: ' + name + ', Methods: ' + methods.length + ', Container: ' + $container.prop('tagName'));
                
                packageGroups.push({
                    container: $container,
                    methods: $methods,
                    packageName: name,
                    packageIndex: index
                });
            }
        });
        
        logDebug('Created ' + packageGroups.length + ' package groups');
        return packageGroups;
    }

    /**
     * Check if a classic package should be converted
     */
    function shouldConvertClassicPackage(packageData) {
        const methodCount = packageData.methods.length;
        const isAlreadySelect = packageData.methods.is('select');
        const isAlreadyConverted = packageData.methods.hasClass(WSDM.constants.CLASSES.SHIPPING_SELECT);
        const isBlockContext = packageData.container.closest('.wp-block-woocommerce-cart, .wp-block-woocommerce-checkout').length > 0;
        
        // Check if this package was already converted
        const packageId = packageData.packageName || packageData.packageIndex || 'unknown';
        const wasAlreadyConverted = WSDM.cache.convertedPackages.has(packageId);
        
        // Check if container already has a converted package
        const containerHasSelect = packageData.container.find('.' + WSDM.constants.CLASSES.SHIPPING_SELECT).length > 0;
        
        // Check if any of the methods are already in a converted wrapper
        const methodsInWrapper = packageData.methods.closest('.wsdm-shipping-wrapper').length > 0;
        
        logDebug('Package conversion check:');
        logDebug('  - Package ID: ' + packageId);
        logDebug('  - Methods count: ' + methodCount);
        logDebug('  - Is already select: ' + isAlreadySelect);
        logDebug('  - Is already converted: ' + isAlreadyConverted);
        logDebug('  - Was already converted: ' + wasAlreadyConverted);
        logDebug('  - Container has select: ' + containerHasSelect);
        logDebug('  - Methods in wrapper: ' + methodsInWrapper);
        logDebug('  - Is block context: ' + isBlockContext);
        
        // Convert if there are 2 or more methods, not already converted, and not in block context
        const shouldConvert = methodCount >= 2 && 
                             !isAlreadySelect && 
                             !isAlreadyConverted && 
                             !wasAlreadyConverted && 
                             !containerHasSelect && 
                             !methodsInWrapper && 
                             !isBlockContext;
        
        logDebug('  - Should convert: ' + shouldConvert);
        
        return shouldConvert;
    }

    /**
     * Convert a package to select dropdown
     */
    function convertPackageToSelect(packageData, packageIndex) {
        const packageId = packageData.packageName || packageData.packageIndex || packageIndex;
        logDebug('Starting conversion for package ' + packageIndex + ' (ID: ' + packageId + ')');
        
        // Mark this package as being converted
        WSDM.cache.convertedPackages.add(packageId);
        
        try {
            const $select = createClassicSelectElement(packageData.methods, packageIndex);
            logDebug('Created select element with ID: ' + $select.attr('id'));
            
            populateClassicOptions(packageData.methods, $select);
            logDebug('Populated ' + $select.find('option').length + ' options');
            
            // Create hidden radio buttons for WooCommerce compatibility
            const $hiddenRadios = createHiddenRadiosForPackage(packageData);
            logDebug('Created hidden radios container with ' + $hiddenRadios.find('input').length + ' radios');
            
            replaceClassicPackageElements(packageData, $select, $hiddenRadios);
            logDebug('Replaced package elements in DOM');
            
            // Mark the container as converted
            packageData.container.addClass(WSDM.constants.CLASSES.PACKAGE_CONVERTED);
            
            bindClassicPackageEvents($select, packageData, $hiddenRadios, packageIndex);
            logDebug('Bound events for package ' + packageIndex);
            
            logDebug('Package ' + packageIndex + ' (ID: ' + packageId + ') conversion completed successfully');
            
        } catch (error) {
            logError('Error converting package ' + packageIndex, error);
            // Remove from converted cache if conversion failed
            WSDM.cache.convertedPackages.delete(packageId);
        }
    }

    /**
     * Create hidden radio buttons for WooCommerce compatibility
     */
    function createHiddenRadiosForPackage(packageData) {
        const $hiddenContainer = $('<div>', {
            style: 'display: none !important;',
            class: 'wsdm-hidden-shipping-radios'
        });
        
        packageData.methods.each(function() {
            const $originalRadio = $(this);
            const $hiddenRadio = $originalRadio.clone(true);
            
            // Ensure the hidden radio maintains all original attributes
            $hiddenRadio.attr({
                'data-wsdm-hidden': 'true',
                'style': 'display: none !important;'
            });
            
            $hiddenContainer.append($hiddenRadio);
        });
        
        return $hiddenContainer;
    }

    /**
     * Create select element for classic shipping
     */
    function createClassicSelectElement($shippingOptions, packageIndex) {
        const $first = $shippingOptions.first();
        return $('<select>', {
            class: `${WSDM.constants.CLASSES.SHIPPING_SELECT}`,
            name: sanitizeAttribute($first.attr('name')),
            'data-index': sanitizeAttribute($first.attr('data-index')),
            'data-package-index': packageIndex || 0,
            'id': 'wsdm-shipping-select-' + (packageIndex || 0)
        });
    }

    /**
     * Populate classic select options
     */
    function populateClassicOptions($shippingOptions, $select) {
        $shippingOptions.each(function() {
            const $radio = $(this);
            const label = sanitizeString($radio.closest('li').text().trim());
            const value = sanitizeAttribute($radio.val());
            const isChecked = $radio.prop('checked');
            
            $('<option>', {
                value: value,
                text: label,
                selected: isChecked
            }).appendTo($select);
        });
    }

    /**
     * Replace classic package elements with select
     */
    function replaceClassicPackageElements(packageData, $select, $hiddenRadios) {
        logDebug('Starting element replacement');
        logDebug('Package container: ' + packageData.container.prop('tagName') + ' (class: ' + packageData.container.attr('class') + ')');
        
        // Create a wrapper div for select and hidden radios
        const $wrapper = $('<div>', { 
            class: 'wsdm-shipping-wrapper',
            'data-package': packageData.packageName || 'unknown'
        });
        $wrapper.append($select, $hiddenRadios);
        
        // Try different replacement strategies
        let replacementSuccess = false;
        
        // Strategy 1: Replace individual method containers
        const $methodContainers = packageData.methods.closest('li, tr, .shipping-method-item, label');
        logDebug('Found ' + $methodContainers.length + ' method containers');
        
        if ($methodContainers.length > 0) {
            try {
                const $firstContainer = $methodContainers.first();
                logDebug('Method containers found. First container: ' + $firstContainer.prop('tagName') + ' (class: ' + $firstContainer.attr('class') + ')');
                
                // Remove all other method containers in this package
                $methodContainers.not($firstContainer).remove();
                logDebug('Removed ' + ($methodContainers.length - 1) + ' other method containers');
                
                // Replace the first container with our wrapper
                $firstContainer.replaceWith($wrapper);
                logDebug('Replaced first container with wrapper');
                replacementSuccess = true;
                
            } catch (error) {
                logError('Error replacing method containers', error);
            }
        }
        
        // Strategy 2: Replace all methods within their common container
        if (!replacementSuccess) {
            try {
                logDebug('Trying to replace all methods within container');
                
                // Hide all the original radio methods
                // packageData.methods.each(function() {
                //     $(this).closest('li, tr, label, div').hide();
                // });
                
                // Insert the wrapper at the beginning of the container
                packageData.container.prepend($wrapper);
                logDebug('Prepended wrapper to container');
                replacementSuccess = true;
                
            } catch (error) {
                logError('Error with container replacement', error);
            }
        }
        
        // Strategy 3: Replace the entire container content (last resort)
        if (!replacementSuccess) {
            try {
                logDebug('Last resort: replacing entire container content');
                packageData.container.html($wrapper);
                logDebug('Replaced container content');
                replacementSuccess = true;
                
            } catch (error) {
                logError('Error replacing container content', error);
            }
        }
        
        // Verify the replacement worked
        setTimeout(function() {
            const $insertedSelect = $('.' + WSDM.constants.CLASSES.SHIPPING_SELECT);
            logDebug('Verification: Found ' + $insertedSelect.length + ' select elements after replacement');
            
            if ($insertedSelect.length === 0) {
                logError('No select elements found after replacement!');
            }
        }, 100);
    }

    /**
     * Bind events for classic package select
     */
    function bindClassicPackageEvents($select, packageData, $hiddenRadios, packageIndex) {
        logDebug('Binding events for package ' + packageIndex + ' select with ID: ' + $select.attr('id'));
        
        // Remove any existing event handlers first
        $select.off('change.wsdm');
        
        $select.on('change.wsdm', function() {
            const selectedValue = $(this).val();
            const selectId = $(this).attr('id');
            logDebug('Package ' + packageIndex + ' select changed to: ' + selectedValue + ' (ID: ' + selectId + ')');
            
            // Set flag to prevent re-initialization
            WSDM.cache.selectChangeInProgress = true;
            
            // Update the corresponding hidden radio button
            const $hiddenRadio = $hiddenRadios.find('input[value="' + selectedValue + '"]');
            if ($hiddenRadio.length) {
                // Uncheck all hidden radios in this package first
                $hiddenRadios.find('input[type="radio"]').prop('checked', false);
                
                // Check the selected one
                $hiddenRadio.prop('checked', true);
                
                // Trigger change event on the hidden radio for WooCommerce
                $hiddenRadio.trigger('change');
                logDebug('Hidden radio updated for package ' + packageIndex);
            } else {
                logDebug('No hidden radio found for value: ' + selectedValue);
            }
            
            // Get form context for proper WooCommerce integration
            const $form = $(this).closest('form');
            
            // Trigger appropriate WooCommerce events
            if ($form.length && ($form.hasClass('checkout') || $form.attr('name') === 'checkout')) {
                logDebug('Triggering checkout update events for package ' + packageIndex);
                // For checkout page
                $('body').trigger('update_checkout');
                $form.trigger('checkout_updated');
            } else {
                logDebug('Triggering cart update events for package ' + packageIndex);
                // For cart page or other contexts
                $('body').trigger('updated_cart_totals');
                
                // Also trigger WooCommerce cart update if available
                if (typeof wc_cart_params !== 'undefined') {
                    $('body').trigger('wc_update_cart');
                }
            }
            
            // Additional fallback for legacy WooCommerce versions
            if (typeof wc_checkout_params !== 'undefined') {
                $(this).trigger('change');
            }
            
            // Force form submission for immediate update - delay to prevent conflicts
            setTimeout(function() {
                if ($form.length) {
                    const $updateBtn = $form.find('[name="update_cart"], .button[name="update_cart"]');
                    if ($updateBtn.length) {
                        logDebug('Triggering update cart button for package ' + packageIndex);
                        $updateBtn.trigger('click');
                    }
                }
            }, 150);
            
            // Clear the flag after sufficient delay
            setTimeout(function() {
                WSDM.cache.selectChangeInProgress = false;
                logDebug('Cleared selectChangeInProgress flag after package ' + packageIndex + ' change');
            }, 1200);
        });
        
        logDebug('Events bound successfully for package ' + packageIndex);
    }

    /**
     * Convert block-based shipping methods to dropdown
     */
    function convertBlockShippingMethods() {
        if (!WSDM.config.is_blocks_enabled || WSDM.config.shipping_format !== 'select') {
            return;
        }

        // Use timeout to ensure block rendering is complete
        const timeoutId = setTimeout(() => {
            processBlockShippingMethods();
            WSDM.cache.timeouts.delete('blockConversion');
        }, WSDM.constants.CONVERSION_DELAY);
        
        WSDM.cache.timeouts.set('blockConversion', timeoutId);
    }

    /**
     * Process all block shipping methods for conversion
     */
    function processBlockShippingMethods() {
        const selector = `${WSDM.constants.BLOCK_SELECTORS.CART}, ${WSDM.constants.BLOCK_SELECTORS.CHECKOUT}`;
        const $methods = $(selector);
        
        $methods.each(function() {
            const $radioGroup = $(this);
            const $radios = $radioGroup.find('input[type="radio"]');
            
            if (shouldConvertBlockMethod($radioGroup, $radios)) {
                convertBlockRadioToSelect($radioGroup, $radios);
                $radioGroup.addClass(WSDM.constants.CLASSES.CONVERTED);
            }
        });
    }

    /**
     * Check if block method should be converted
     */
    function shouldConvertBlockMethod($radioGroup, $radios) {
        return $radios.length > 1 && 
               !$radioGroup.hasClass(WSDM.constants.CLASSES.CONVERTED) && 
               $radioGroup.is(':visible');
    }

    function convertBlockRadioToSelect($radioGroup, $radios) {
        const controlName = $radios.first().attr('name');
        const labelId = $radioGroup.closest('[id]').attr('id') || ('shipping-option-' + Math.random().toString(36).slice(2));

        // Resolve package index from name like radio-control-<index>
        const pkgMatch = String(controlName || '').match(/radio-control-(\d+)/);
        const packageIndex = pkgMatch ? parseInt(pkgMatch[1], 10) : 0;

        // Build WC Blocks select structure
        const $outer = $('<div>', { class: 'wc-blocks-components-select' });
        const $container = $('<div>', { class: 'wc-blocks-components-select__container' });

        // Try to find the group label text from preceding h3/label; fallback to Shipping options
        let groupLabel = window.wsdm_params.shipping_options_label;
        const $maybeHeading = $radioGroup.prev('h3, h4, label').first();
        if ($maybeHeading.length) {
            groupLabel = $.trim($maybeHeading.text());
        }

        const $label = $('<label>', {
            class: 'wc-blocks-components-select__label',
            for: labelId + '-select'
        }).text(groupLabel);

        const $select = $('<select>', {
            id: labelId + '-select',
            class: 'wc-blocks-components-select__select wsdm-block-shipping-select',
            'data-package-id': controlName,
            size: 1
        });

        // Try to fetch method metadata from Store API to format price properly
        const ratesById = getStoreRatesByIdForPackage(packageIndex);
        
        $radios.each(function() {
            const $radio = $(this);
            const methodId = $radio.val();
            let optionLabel;

            if (ratesById && ratesById[methodId]) {
                const meta = ratesById[methodId];
                const formattedCost = formatCurrency(meta.cost);
                optionLabel = `${meta.label} (${formattedCost})`;
            } else {
                // Fallback to DOM parsing
                const $labelNode = $radioGroup.find('label[for="' + $radio.attr('id') + '"]');
                const priceText = $.trim($labelNode.find('.wc-block-components-radio-control__secondary-label').text());
                let nameText = $.trim(
                    $labelNode
                        .clone()
                        .find('.wc-block-components-radio-control__secondary-label')
                        .remove()
                        .end()
                        .text()
                );
                nameText = nameText.replace(/\s+/g, ' ').trim();
                let finalPrice = priceText;
                if (!finalPrice) {
                    const matchPrice = $labelNode.text().match(/([₹$€£]\s?[\d.,]+(?:\s?[A-Z]{3})?)/);
                    if (matchPrice) {
                        finalPrice = matchPrice[1].trim();
                    }
                }
                optionLabel = finalPrice ? `${nameText} (${finalPrice})` : nameText;
            }

            $('<option>', {
                value: methodId,
                text: optionLabel,
                selected: $radio.is(':checked')
            }).appendTo($select);
        });

        // SVG arrow same as country select
        const $svg = $(
            '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="24" height="24" class="wc-blocks-components-select__expand" aria-hidden="true" focusable="false">' +
            '<path d="M17.5 11.6L12 16l-5.5-4.4.9-1.2L12 14l4.5-3.6 1 1.2z"></path>' +
            '</svg>'
        );

        $container.append($label, $select, $svg);
        $outer.append($container);

        // Hide the original radio wrapper but keep it for React updates
        const $wrapper = $radioGroup.closest('.wc-block-components-radio-control');
        $wrapper.hide().after($outer);
        
        // Store reference to hidden wrapper for syncing
        $outer.data('original-wrapper', $wrapper);

        // Handle selection changes -> sync with hidden radio and trigger Store API
        $select.on('change', function() {
            const selectedRate = $(this).val();
            
            // Update hidden radio to keep React state in sync
            const $hiddenRadio = $wrapper.find('input[type="radio"][value="' + selectedRate + '"]');
            if ($hiddenRadio.length) {
                $hiddenRadio.prop('checked', true).trigger('change');
            }
            
            // Also dispatch to Store API as backup
            const match = String($(this).attr('data-package-id') || '').match(/radio-control-(\d+)/);
            const packageId = match ? parseInt(match[1], 10) : 0;
            
            if (typeof wp !== 'undefined' && wp.data && wp.data.dispatch('wc/store/cart')) {
                wp.data.dispatch('wc/store/cart').selectShippingRate(selectedRate, packageId);
            }
        });

        // Set up observer to sync dropdown when React updates the hidden radios
        setupRadioSyncObserver($wrapper, $select);
    }

    /**
     * Set up mutation observer to sync dropdown with hidden radios
     */
    function setupRadioSyncObserver($hiddenWrapper, $dropdown) {
        if (!window.MutationObserver) {
            return;
        }

        const syncHandler = debounce(() => {
            syncDropdownWithRadios($hiddenWrapper, $dropdown);
        }, WSDM.constants.SYNC_DEBOUNCE_DELAY);
        
        const observer = new MutationObserver((mutations) => {
            const shouldSync = mutations.some(mutation => 
                mutation.type === 'childList' || 
                (mutation.type === 'attributes' && 
                 mutation.target.type === 'radio' && 
                 ['checked', 'value'].includes(mutation.attributeName))
            );

            if (shouldSync) {
                syncHandler();
            }
        });

        try {
            observer.observe($hiddenWrapper[0], {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['checked', 'value']
            });

            // Store observer reference for cleanup
            $dropdown.data('radio-observer', observer);
            WSDM.cache.observers.set($dropdown[0], observer);
        } catch (error) {
            logError('Failed to set up mutation observer', error);
        }
    }

    function syncDropdownWithRadios($hiddenWrapper, $dropdown) {
        try {
            // Check if dropdown still exists and is visible
            if (!$dropdown.length || !$dropdown.is(':visible')) {
                return;
            }
            
            const $radios = $hiddenWrapper.find('input[type="radio"]');
            
            // If no radios found, don't update
            if ($radios.length === 0) {
                return;
            }
            
            const currentValue = $dropdown.val();
            
            // Check if options actually changed by comparing values
            const newValues = $radios.map(function() { return $(this).val(); }).get().sort();
            const oldValues = $dropdown.find('option').map(function() { return $(this).val(); }).get().sort();
            
            if (JSON.stringify(newValues) === JSON.stringify(oldValues)) {
                // Options haven't changed, just update selection
                const checkedValue = $radios.filter(':checked').val();
                if (checkedValue && checkedValue !== currentValue) {
                    $dropdown.val(checkedValue);
                }
                return;
            }
            
            // Clear and rebuild dropdown options
            $dropdown.empty();
            
            const packageIndex = getPackageIndexFromWrapper($hiddenWrapper);
            const ratesById = getStoreRatesByIdForPackage(packageIndex);
            
            let hasCurrentValue = false;
            let firstValue = null;
            let checkedValue = null;
            
            $radios.each(function() {
                const $radio = $(this);
                const methodId = $radio.val();
                if (!firstValue) {
                    firstValue = methodId;
                }
                if (methodId === currentValue) {
                    hasCurrentValue = true;
                }
                if ($radio.is(':checked')) {
                    checkedValue = methodId;
                }
                
                let optionLabel;
                
                if (ratesById && ratesById[methodId]) {
                    const meta = ratesById[methodId];
                    const formattedCost = formatCurrency(meta.cost);
                    optionLabel = `${meta.label} (${formattedCost})`;
                } else {
                    // Fallback to DOM parsing from hidden radio label
                    const $labelNode = $hiddenWrapper.find('label[for="' + $radio.attr('id') + '"]');
                    const priceText = $.trim($labelNode.find('.wc-block-components-radio-control__secondary-label').text());
                    let nameText = $.trim(
                        $labelNode
                            .clone()
                            .find('.wc-block-components-radio-control__secondary-label')
                            .remove()
                            .end()
                            .text()
                    );
                    nameText = nameText.replace(/\s+/g, ' ').trim();
                    let finalPrice = priceText;
                    if (!finalPrice) {
                        const matchPrice = $labelNode.text().match(/([₹$€£]\s?[\d.,]+(?:\s?[A-Z]{3})?)/);
                        if (matchPrice) {
                            finalPrice = matchPrice[1].trim();
                        }
                    }
                    optionLabel = finalPrice ? `${nameText} (${finalPrice})` : nameText;
                }
                
                $('<option>', {
                    value: methodId,
                    text: optionLabel,
                    selected: $radio.is(':checked')
                }).appendTo($dropdown);
            });
            
            // Set the correct value based on radio state or fallback
            if (checkedValue) {
                $dropdown.val(checkedValue);
            } else if (!hasCurrentValue && firstValue) {
                // Auto-select first option if current selection is no longer available
                $dropdown.val(firstValue);
                const $firstRadio = $hiddenWrapper.find('input[type="radio"][value="' + firstValue + '"]');
                if ($firstRadio.length) {
                    $firstRadio.prop('checked', true).trigger('change');
                }
                // Also dispatch to Store API as backup for update in cart
                const match = String($dropdown.attr('data-package-id') || '').match(/radio-control-(\d+)/);
                const packageId = match ? parseInt(match[1], 10) : 0;
                if (typeof wp !== 'undefined' && wp.data && wp.data.dispatch('wc/store/cart')) {
                    wp.data.dispatch('wc/store/cart').selectShippingRate(firstValue, packageId);
                }
            }
            
        } catch (error) {
            logError('Failed to sync dropdown with radios', error);
        }
    }

    function getPackageIndexFromWrapper($wrapper) {
        const $radios = $wrapper.find('input[type="radio"]');
        if ($radios.length > 0) {
            const name = $radios.first().attr('name');
            const match = String(name || '').match(/radio-control-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        }
        return 0;
    }

    /**
     * Get shipping rates by ID for a specific package
     */
    function getStoreRatesByIdForPackage(packageIndex) {
        try {
            if (!isWpDataAvailable()) {
                return null;
            }
            
            const store = wp.data.select('wc/store/cart');
            if (!store) {
                return null;
            }
            
            const cart = store.getCartData?.() || null;
            if (!cart) {
                return null;
            }
            
            // Try our extension data first
            const extensionRates = getExtensionRates(cart, packageIndex);
            if (extensionRates) {
                return extensionRates;
            }
            
            // Fallback to native shipping rates
            return getNativeRates(cart, packageIndex);
            
        } catch (error) {
            logError('Failed to get store rates', error);
            return null;
        }
    }

    /**
     * Get rates from our extension data
     */
    function getExtensionRates(cart, packageIndex) {
        const ext = cart.extensions?.['woo-shipping-display-mode'];
        if (!ext?.available_packages?.[packageIndex]) {
            return null;
        }
        
        const methods = ext.available_packages[packageIndex].available_methods || [];
        const ratesMap = {};
        
        methods.forEach(method => {
            if (method.id && method.label) {
                ratesMap[method.id] = {
                    label: sanitizeString(method.label),
                    cost: parseFloat(method.cost) || 0
                };
            }
        });
        
        return Object.keys(ratesMap).length > 0 ? ratesMap : null;
    }

    /**
     * Get rates from native WooCommerce data
     */
    function getNativeRates(cart, packageIndex) {
        const pkg = cart.shippingRates?.[packageIndex];
        if (!pkg?.rates || !Array.isArray(pkg.rates)) {
            return null;
        }
        
        const ratesMap = {};
        
        pkg.rates.forEach(rate => {
            const id = rate.rate_id || rate.id;
            if (id) {
                ratesMap[id] = {
                    label: sanitizeString(rate.name || rate.label || rate.method_name),
                    cost: parseFloat(rate.price || rate.cost) || 0
                };
            }
        });
        
        return Object.keys(ratesMap).length > 0 ? ratesMap : null;
    }

    function formatCurrency(amount) {
        const cur = (window.wcSettings && window.wcSettings.currency) || {};
        const symbol = cur.symbol || '$';
        const position = cur.symbolPosition || 'left';
        const thousand = cur.thousandSeparator || ',';
        const decimal = cur.decimalSeparator || '.';
        const precision = typeof cur.precision === 'number' ? cur.precision : 2;

        const n = isNaN(amount) ? 0 : Number(amount);
        const fixed = n.toFixed(precision);
        const parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
        const number = precision > 0 ? parts.join(decimal) : parts[0];

        switch (position) {
            case 'left_space':
                return symbol + ' ' + number;
            case 'right':
                return number + symbol;
            case 'right_space':
                return number + ' ' + symbol;
            case 'left':
            default:
                return symbol + number;
        }
    }

    // =========================
    // UTILITY FUNCTIONS
    // =========================

    /**
     * Check if WordPress data is available
     */
    function isWpDataAvailable() {
        return typeof wp !== 'undefined' && wp.data;
    }

    /**
     * Sanitize string input with fallback
     */
    function sanitizeString(input, fallback = '') {
        if (typeof input !== 'string') {
            return fallback;
        }
        return input.trim() || fallback;
    }

    /**
     * Sanitize attribute value
     */
    function sanitizeAttribute(input) {
        return sanitizeString(String(input || ''));
    }

    /**
     * Debounce function execution
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Clear all cached timeouts
     */
    function clearAllTimeouts() {
        WSDM.cache.timeouts.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        WSDM.cache.timeouts.clear();
    }

    /**
     * Clean up mutation observers
     */
    function cleanupObservers() {
        $(`.${WSDM.constants.CLASSES.BLOCK_SELECT}`).each(function() {
            const observer = $(this).data('radio-observer');
            if (observer && typeof observer.disconnect === 'function') {
                observer.disconnect();
            }
        });
    }

    /**
     * Safe console logging for debug
     */
    function logDebug(message) {
        if (typeof console !== 'undefined' && console.log && window.wsdm_debug) {
            console.log(`WSDM Debug: ${message}`);
        }
    }

    /**
     * Safe console logging
     */
    function logError(message, error) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(`WSDM: ${message}`, error);
        }
    }

    // =========================
    // PUBLIC API
    // =========================

    /**
     * Public API for external use
     */
    window.wsdmShippingDisplayMode = Object.freeze({
        init: initializeShippingMethods,
        cleanup: cleanupObservers,
        config: WSDM.config,
        debug: {
            forceConversion: function() {
                logDebug('Force conversion called via API');
                initializeShippingMethods();
            },
            forceSelectMode: function() {
                logDebug('Forcing select mode for testing');
                WSDM.config.shipping_format = 'select';
                // Clear conversion state
                WSDM.cache.convertedPackages.clear();
                WSDM.cache.conversionInProgress = false;
                initializeShippingMethods();
            },
            resetConversionState: function() {
                logDebug('Resetting conversion state');
                WSDM.cache.convertedPackages.clear();
                WSDM.cache.conversionInProgress = false;
                WSDM.cache.selectChangeInProgress = false;
                // Remove converted classes
                $('.' + WSDM.constants.CLASSES.PACKAGE_CONVERTED).removeClass(WSDM.constants.CLASSES.PACKAGE_CONVERTED);
                $('.' + WSDM.constants.CLASSES.SHIPPING_SELECT).remove();
                $('.wsdm-shipping-wrapper').remove();
            },
            getPackageGroups: function() {
                return groupShippingMethodsByPackage();
            },
            getConfig: function() {
                return WSDM.config;
            },
            getStatus: function() {
                const status = {
                    config: WSDM.config,
                    shippingMethods: $('.shipping_method').length,
                    selectDropdowns: $('.' + WSDM.constants.CLASSES.SHIPPING_SELECT).length,
                    packageGroups: groupShippingMethodsByPackage().length,
                    blockElements: $('.wp-block-woocommerce-cart, .wp-block-woocommerce-checkout').length
                };
                
                console.log('WSDM Status Report:', status);
                return status;
            },
            analyzeHTML: function() {
                const $methods = $('.shipping_method');
                console.log('=== HTML Structure Analysis ===');
                console.log('Found ' + $methods.length + ' shipping methods');
                
                $methods.each(function(index) {
                    const $method = $(this);
                    console.log('\n--- Method ' + index + ' ---');
                    console.log('HTML:', $method.prop('outerHTML'));
                    console.log('Name:', $method.attr('name'));
                    console.log('Value:', $method.val());
                    console.log('Parent:', $method.parent().prop('tagName'), $method.parent().attr('class'));
                    console.log('Grandparent:', $method.parent().parent().prop('tagName'), $method.parent().parent().attr('class'));
                    console.log('Great-grandparent:', $method.parent().parent().parent().prop('tagName'), $method.parent().parent().parent().attr('class'));
                });
                
                return {
                    methods: $methods.length,
                    structure: 'Check console for detailed structure'
                };
            },
            enableDebug: function() {
                window.wsdm_debug = true;
            },
            disableDebug: function() {
                window.wsdm_debug = false;
            }
        }
    });

})(jQuery);