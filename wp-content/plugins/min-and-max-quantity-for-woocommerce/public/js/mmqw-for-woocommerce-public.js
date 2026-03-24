(function () {
	'use strict';

	/**
	 * All of the code for your public-facing JavaScript source
	 * should reside in this file.
	 *
	 * Note: It has been assumed you will write jQuery code here, so the
	 * $ function reference has been prepared for usage within the scope
	 * of this function.
	 *
	 * This enables you to define handlers, for when the DOM is ready:
	 *
	 * $(function() {
	 *
	 * });
	 *
	 * When the window is loaded:
	 *
	 * $( window ).load(function() {
	 *
	 * });
	 *
	 * ...and/or other possibilities.
	 *
	 * Ideally, it is not considered best practise to attach more than a
	 * single DOM-ready or window-load handler for a particular page.
	 * Although scripts in the WordPress core, Plugins and Themes may be
	 * practising this, we should strive to set a better example in our own work.

	 */

	jQuery(document).ready(function () {
		jQuery('body').on('change', 'input[name="payment_method"]', function () {
			jQuery('body').trigger('update_checkout');
		});
		var static_qty = 0;
		jQuery(document.body).on('updated_cart_totals', function () {
			jQuery('.product-quantity').find('.quantity input[type="hidden"]').each(function () {
				let qty_val = jQuery(this).val();
				let qty_span = jQuery('<span></span>').addClass('mmqw-fixed-qunatity').text(qty_val);
				jQuery(this).after(qty_span);
			});
			static_qty++;
		});
		jQuery('.product-quantity').find('.quantity input[type="hidden"]').each(function () {
			let qty_val = jQuery(this).val();
			let qty_span = jQuery('<span></span>').addClass('mmqw-fixed-qunatity').text(qty_val);
			jQuery(this).after(qty_span);
			static_qty++;
		});
		if (static_qty > 0) {
			setTimeout(function () {
				jQuery('button[name="update_cart"]').prop('disabled', false);
				jQuery('button[name="update_cart"]').trigger('click');
			}, 2000);
		}

		setTimeout(function () {
			jQuery('.single-product .cart').find('.quantity input[type="hidden"]').each(function () {
				let qty_val = jQuery(this).val();
				console.log(jQuery(this));
				console.log(jQuery(this).val());
				let text_qty = jQuery('<strong></strong>').text(mmqw_plugin_vars.one_quantity);
				let qty_span = jQuery('<span></span>').addClass('mmqw-fixed-qunatity').append(text_qty).append(qty_val);
				jQuery(this).after(qty_span);
			});
		}, 1000);

		jQuery(document).on('change', '.input-text.qty.text', function () {
			let currentVal = jQuery(this).val();
			let minVal = jQuery(this).attr('min');
			let maxVal = jQuery(this).attr('max');

			if (parseInt(currentVal) < parseInt(minVal)) {
				jQuery(this).val(minVal);
			} else if (parseInt(currentVal) > parseInt(maxVal)) {
				jQuery(this).val(maxVal);
			}
		});
	});

	jQuery(window).on('load', function () {
		function update_quantity() {
			// Fires whenever variation selects are changed
			var min_qty = jQuery('.quantity .input-text.qty.text').attr('min');
			if ('' !== min_qty) {
				jQuery('.quantity .input-text.qty.text').val(min_qty);
			}
		}
		jQuery('.variations_form').on('woocommerce_variation_select_change', function () {
			setTimeout(update_quantity, 200);
		});
	});

})();
