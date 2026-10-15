#include <stdio.h>
#include <stdlib.h>
#include <setjmp.h>
#include <jpeglib.h>
struct errors { struct jpeg_error_mgr base; jmp_buf jump; };
static void fail(j_common_ptr p) { longjmp(((struct errors*)p->err)->jump,1); }
static unsigned char *output;
static unsigned long output_length;
unsigned char *result_data(void) { return output; }
unsigned long result_size(void) { return output_length; }
int optimize_jpeg(unsigned char *input, unsigned long length, int progressive) {
 struct jpeg_decompress_struct src={0}; struct jpeg_compress_struct dst={0}; struct errors err;
 free(output);output=NULL;output_length=0;
 src.err=jpeg_std_error(&err.base);err.base.error_exit=fail;
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
