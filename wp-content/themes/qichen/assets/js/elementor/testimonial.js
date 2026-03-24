(function($){
	"use strict";
	
	$(window).on('elementor/frontend/init', function () {
		
        elementorFrontend.hooks.addAction('frontend/element_ready/qichen_elementor_testimonial.default', function(){
	       
	        $(".ova-testimonial .slide-testimonials").each(function(){

		        var owlsl 		= $(this) ;
		        var owlsl_ops 	= owlsl.data('options') ? owlsl.data('options') : {};

		        var responsive_value = {
		            0:{
		              	items:1,
		            },
		        };
		        
		        owlsl.owlCarousel({
		          	autoWidth: owlsl_ops.autoWidth,
		          	margin:0,
		          	items: 1,
		          	loop: owlsl_ops.loop,
		          	autoplay: owlsl_ops.autoplay,
		          	autoplayTimeout: owlsl_ops.autoplayTimeout,
		          	thumbs: owlsl_ops.thumbs,
		          	dots:owlsl_ops.dots,
		          	autoplayHoverPause: owlsl_ops.autoplayHoverPause,
		          	slideBy: owlsl_ops.slideBy,
		          	smartSpeed: owlsl_ops.smartSpeed,
		          	rtl: owlsl_ops.rtl,
		          	navText:[
		          		'<i class="flaticon2 flaticon2-left-arrow"></i>',
		          		'<i class="flaticon2 flaticon2-right-arrow-2"></i>',
		          	],
		          	responsive: responsive_value,
		        });

		      	/* Fixed WCAG */
				owlsl.find(".owl-nav button.owl-prev").attr("title", "Previous");
				owlsl.find(".owl-nav button.owl-next").attr("title", "Next");
				owlsl.find(".owl-dots button").attr("title", "Dots");

		    });
	    	
        });
        
   });

})(jQuery);
