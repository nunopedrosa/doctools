#include <stdio.h>
#include <stdlib.h>
#include <setjmp.h>
#include <jpeglib.h>
struct errors { struct jpeg_error_mgr base; jmp_buf jump; };
static void fail(j_common_ptr p) { longjmp(((struct errors*)p->err)->jump,1); }
static void warning(j_common_ptr p, int level) { if(level<0)fail(p); }
static unsigned char *output;
static unsigned long output_length;
unsigned char *result_data(void) { return output; }
unsigned long result_size(void) { return output_length; }
int optimize_jpeg(unsigned char *input, unsigned long length, int progressive) {
 struct jpeg_decompress_struct src={0}; struct jpeg_compress_struct dst={0}; struct errors err;
 free(output);output=NULL;output_length=0;
 src.err=jpeg_std_error(&err.base);err.base.error_exit=fail;err.base.emit_message=warning;
 dst.err=&err.base;
 if(setjmp(err.jump)) { jpeg_destroy_decompress(&src);jpeg_destroy_compress(&dst);free(output);output=NULL;output_length=0;return 0; }
 jpeg_create_decompress(&src);jpeg_mem_src(&src,input,length);
 for(int i=0;i<16;i++)jpeg_save_markers(&src,JPEG_APP0+i,0xFFFF);
 jpeg_save_markers(&src,JPEG_COM,0xFFFF);
 jpeg_read_header(&src,TRUE);
 if(src.image_width*(double)src.image_height>25000000 || src.num_components>3) {jpeg_destroy_decompress(&src);return 0;}
 jvirt_barray_ptr *coeff=jpeg_read_coefficients(&src);
 jpeg_create_compress(&dst);jpeg_mem_dest(&dst,&output,&output_length);
 jpeg_copy_critical_parameters(&src,&dst);dst.optimize_coding=TRUE;
 dst.write_JFIF_header=FALSE;dst.write_Adobe_marker=FALSE;
 if(progressive)jpeg_simple_progression(&dst);
 jpeg_write_coefficients(&dst,coeff);
 for(jpeg_saved_marker_ptr m=src.marker_list;m;m=m->next)jpeg_write_marker(&dst,m->marker,m->data,m->data_length);
 jpeg_finish_compress(&dst);jpeg_finish_decompress(&src);
 jpeg_destroy_compress(&dst);jpeg_destroy_decompress(&src);return 1;
}

/* Optional pixel-changing recompression. Heap-owned codec state stays valid
 * across longjmp; row storage belongs to the decoder's image pool. */
struct recompressor { struct jpeg_decompress_struct src; struct jpeg_compress_struct dst; struct errors err; };
int recompress_jpeg(unsigned char *input, unsigned long length, int quality) {
 free(output);output=NULL;output_length=0;
 if(quality<1||quality>95)return 0;
 struct recompressor *state=calloc(1,sizeof(*state));if(!state)return 0;
 struct jpeg_decompress_struct *src=&state->src;
 struct jpeg_compress_struct *dst=&state->dst;
 src->err=jpeg_std_error(&state->err.base);src->err->error_exit=fail;src->err->emit_message=warning;dst->err=src->err;
 if(setjmp(state->err.jump)) {
  jpeg_destroy_decompress(src);jpeg_destroy_compress(dst);free(state);free(output);output=NULL;output_length=0;return 0;
 }
 jpeg_create_decompress(src);jpeg_mem_src(src,input,length);
 for(int i=0;i<16;i++)jpeg_save_markers(src,JPEG_APP0+i,0xFFFF);
 jpeg_save_markers(src,JPEG_COM,0xFFFF);jpeg_read_header(src,TRUE);
 if(src->image_width*(double)src->image_height>25000000||src->data_precision!=8||
    (src->jpeg_color_space!=JCS_YCbCr&&src->jpeg_color_space!=JCS_GRAYSCALE)) {
  jpeg_destroy_decompress(src);free(state);return 0;
 }
 src->out_color_space=src->jpeg_color_space==JCS_GRAYSCALE?JCS_GRAYSCALE:JCS_RGB;
 jpeg_start_decompress(src);
 jpeg_create_compress(dst);jpeg_mem_dest(dst,&output,&output_length);
 dst->image_width=src->output_width;dst->image_height=src->output_height;
 dst->input_components=src->output_components;dst->in_color_space=src->out_color_space;
 jpeg_set_defaults(dst);jpeg_set_quality(dst,quality,TRUE);dst->optimize_coding=TRUE;
 dst->write_JFIF_header=FALSE;dst->write_Adobe_marker=FALSE;
 for(int i=0;i<src->num_components;i++) {
  dst->comp_info[i].component_id=src->comp_info[i].component_id;
  dst->comp_info[i].h_samp_factor=src->comp_info[i].h_samp_factor;
  dst->comp_info[i].v_samp_factor=src->comp_info[i].v_samp_factor;
 }
 jpeg_start_compress(dst,TRUE);
 for(jpeg_saved_marker_ptr m=src->marker_list;m;m=m->next)jpeg_write_marker(dst,m->marker,m->data,m->data_length);
 JSAMPARRAY row=(*src->mem->alloc_sarray)((j_common_ptr)src,JPOOL_IMAGE,src->output_width*src->output_components,1);
 while(src->output_scanline<src->output_height){jpeg_read_scanlines(src,row,1);jpeg_write_scanlines(dst,row,1);}
 jpeg_finish_decompress(src);jpeg_finish_compress(dst);
 jpeg_destroy_decompress(src);jpeg_destroy_compress(dst);free(state);return 1;
}
