(function($){
	"use strict";
	

	$(window).on('elementor/frontend/init', function () {
		
        elementorFrontend.hooks.addAction('frontend/element_ready/qichen_elementor_gallery_slide.default', function(){
	       
	      	/* Add your code here */
			$(".ova-gallery-slide .gallery-slide").each(function(){
				
		        var owlsl 		= $(this);
		        var owlsl_ops 	= owlsl.data('options') ? owlsl.data('options') : {};    

		        if ( owlsl_ops.items == 6 ) {
                	var responsive_value = {
			            0:{
			                items:1,
			                nav:false,
			            },
			            420:{
			              	items:2,
			            },
			            768:{
			              	items:2,
			            },
			            1024:{
			              	items:3,
			            },
			            1200:{
			              	items:4,
			            },
			            1360:{
			              	items:5,
			            },
			            1920:{
			              	items:owlsl_ops.items,
			            }
			        };
                } else if( owlsl_ops.items >=4 ) {
                    var responsive_value = {
			            0:{
			              	items:1,
			              	nav:false,
			            },
			            420:{
			              	items:2,
			            },
			            768:{
			              	items:owlsl_ops.items-2,
			            },
			            1024:{
			              	items:owlsl_ops.items-1,
			            },
			            1170:{
			              	items:owlsl_ops.items,
			            }
			        };
                } else {
                	var responsive_value = {
			            0:{
			              	items:1,
			              	nav:false,
			            },
			            768:{
			              	items:2,
			            },
			            1024:{
			              	items:owlsl_ops.items,
			            }
			        };
                }
		        
		    	owlsl.owlCarousel({
			        autoWidth: owlsl_ops.autoWidth,
			        margin: owlsl_ops.margin,
			        items: owlsl_ops.items,
			        loop: owlsl_ops.loop,
			        autoplay: owlsl_ops.autoplay,
			        autoplayTimeout: owlsl_ops.autoplayTimeout,
			        center: owlsl_ops.center,
					nav: owlsl_ops.nav,
					dots: owlsl_ops.dots,
					rtl: owlsl_ops.rtl,
					thumbs: owlsl_ops.thumbs,
					autoplayHoverPause: owlsl_ops.autoplayHoverPause,
					slideBy: owlsl_ops.slideBy,
					smartSpeed: owlsl_ops.smartSpeed,
					navText:[
					'<i class="ovaicon ovaicon-back" ></i>',
					'<i class="ovaicon ovaicon-next" ></i>'
					],
					responsive: responsive_value,
	        	});
                

                // Fancybox
                owlsl.find('.gallery-fancybox').off('click').on('click', function() {

					var index = $(this).data('index');
					var gallery_data = $(this).closest('.ova-gallery-slide').find('.data-gallery-slide').data('gallery');

					Fancybox.show(gallery_data, {
		            	Image: {
						    Panzoom: {
						      	zoomFriction: 0.7,
						      	maxScale: function () {
						        	return 3;
						      	},
						    },
					  	},
					  	startIndex: index,
					});

				});
               
	        
		    });

        });

   });

})(jQuery);