import contextlib
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build


class PortfolioBuildTests(unittest.TestCase):
    def setUp(self):
        scratch = build.ROOT / '.qa'
        scratch.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=scratch)
        self.root = Path(self.temp.name) / 'portfolio'
        shutil.copytree(build.ROOT, self.root, ignore=shutil.ignore_patterns('dist','.qa','__pycache__','.git','node_modules','.wrangler'))

    def tearDown(self):
        self.temp.cleanup()

    def json(self, name):
        return build.read_json(self.root/name)

    def write(self, name, value):
        path = self.root/name
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(value),encoding='utf-8')

    def compile(self, **options):
        with contextlib.redirect_stdout(io.StringIO()):
            data = build.build(self.root, **options)
        self.output = (self.root/'dist/index.html').read_text(encoding='utf-8')
        self.document = build.Document(self.output)
        return data

    def test_original_sections_assets_and_effects(self):
        data=self.compile()
        self.assertEqual([n.attrs['id'] for n in self.document.root.find_all(tag='section')], ['home','about','projects','skills','experience','research','certifications','reviews','contact'])
        card_count=sum(1 for item in data['projects']+data['research'] if item.get('published',True))
        for cls,count in [('proj-card',card_count),('skill-card',6),('tl-item',5),('footer-social',4),('cert-card',8),('sk-bar-fill',0)]:
            self.assertEqual(len(self.document.root.find_all(cls=cls)),count)
        for name in ['css/styles.css','js/main.js','CV.pdf','images/My_pic.jpeg']:
            self.assertEqual((self.root/name).read_bytes(),(self.root/'dist'/name).read_bytes())
        self.assertIn('Fazley Rabbi — CSE Student &amp; ML Explorer',self.output)
        self.assertNotIn('decap-cms',self.output)
        self.assertNotIn('href="admin',self.output)
        form = self.document.root.find(id='contact-form')
        self.assertEqual(len(form.find_all(tag='input')),3)
        self.assertEqual(len(form.find_all(tag='textarea')),1)
        self.assertEqual(len(form.find_all(tag='button')),1)

    def test_project_crud_and_empty_collections(self):
        existing = next((self.root/'content/projects').glob('*.json'))
        value = self.json(existing.relative_to(self.root))
        value.update(id='cms-added',title='CMS Added Project',order=0,featured=True)
        self.write('content/projects/cms-added.json',value)
        self.compile()
        self.assertIn('CMS Added Project',self.output)
        value['title']='CMS Edited Project'
        self.write('content/projects/cms-added.json',value)
        self.compile()
        self.assertIn('CMS Edited Project',self.output)
        self.assertNotIn('CMS Added Project',self.output)
        (self.root/'content/projects/cms-added.json').unlink()
        self.compile()
        self.assertNotIn('CMS Edited Project',self.output)
        self.assertTrue((self.root/'images/thira.jpg').exists())
        for directory in ['projects','research']:
            for path in (self.root/f'content/{directory}').glob('*.json'): path.unlink()
        self.compile()
        self.assertEqual(len(self.document.root.find_all(cls='proj-card')),0)
        config=self.json('dist/admin/config.yml')
        self.assertTrue(config['collections'][1]['create'])

    def test_drafts_excluded_from_page_and_source_not_published(self):
        item=self.json(next((self.root/'content/projects').glob('*.json')).relative_to(self.root))
        item.update(id='private-draft',title='PRIVATE DRAFT NEEDLE',description='DRAFT BODY NEEDLE',published=False)
        self.write('content/projects/private-draft.json',item)
        self.compile()
        self.assertNotIn('PRIVATE DRAFT NEEDLE',self.output)
        self.assertNotIn('DRAFT BODY NEEDLE',self.output)
        for name in ['content','cms','auth','tests','scripts','index.template.html']:
            self.assertFalse((self.root/'dist'/name).exists())

    def test_content_edits_flow_into_the_page(self):
        profile=self.json('content/profile.json')
        profile.update(name='CMS Name',introduction='CMS introduction',profile_photo='images/rr.jpg',cv_label='Get updated resume')
        profile['biography']=['A **bold** biography.']
        profile['badges'].append(dict(icon='✨',title='New badge',subtitle='New subtitle'))
        self.write('content/profile.json',profile)
        contact=self.json('content/contact.json')
        contact.update(email='editor@example.com',phone='+8801000000000',phone_display='CMS phone',location='CMS location')
        contact['links'][2]['url']='https://github.com/edited-account'
        self.write('content/contact.json',contact)
        skills=self.json('content/skills.json')
        skills['categories'][0]['visualization']='bars'
        skills['categories'][0]['items'].append(dict(name='CMS Skill',percent=73,proficiency='73%',order=5))
        self.write('content/skills.json',skills)
        education=self.json('content/education.json')
        education['items'][0].update(gpa='3.91',department='CMS Department',organization='CMS University')
        self.write('content/education.json',education)
        research_files=list((self.root/'content/research').glob('*.json'))
        research_needles=[]
        if research_files:
            research=self.json(research_files[0].relative_to(self.root))
            research.update(abstract='CMS abstract',dataset='CMS dataset',methodology='CMS methods',authors=['CMS Author'])
            self.write('content/research/research-edited.json',{**research,'id':'research-edited'})
            research_needles=['CMS abstract','CMS dataset','CMS methods','CMS Author']
        self.compile()
        for text in ['CMS Name','CMS introduction','images/rr.jpg','Get updated resume','<strong>bold</strong>','New badge','mailto:editor@example.com','tel:+8801000000000','CMS phone','CMS location','https://github.com/edited-account','CMS Skill','data-w="73"','3.91','CMS Department','CMS University',*research_needles]:
            self.assertIn(text,self.output)

    def test_cv_replacement_preserves_stable_url(self):
        pdf=b'%PDF-1.7\nReplacement fixture\n%%EOF'
        (self.root/'uploads').mkdir(exist_ok=True)
        (self.root/'uploads/replacement.pdf').write_bytes(pdf)
        self.write('content/resume.json',dict(file='/portfolio/uploads/replacement.pdf'))
        self.compile(site_url='https://example.github.io/portfolio')
        self.assertEqual((self.root/'dist/CV.pdf').read_bytes(),pdf)
        self.assertIn('href="CV.pdf"',self.output)
        self.assertTrue((self.root/'CV.pdf').exists())

    def test_hero_photo_replacement_and_optional_fallback(self):
        profile=self.json('content/profile.json')
        profile['hero_photo']='images/me.jpeg'
        self.write('content/profile.json',profile)
        self.compile()
        self.assertEqual(self.document.root.find(cls='hero-portrait').attrs['src'],'images/me.jpeg')
        profile['hero_photo']=''
        self.write('content/profile.json',profile)
        self.compile()
        self.assertEqual(self.document.root.find(cls='hero-portrait').attrs['src'],profile['profile_photo'])

    def test_optional_project_buttons_and_twenty_tags(self):
        value=self.json(next((self.root/'content/projects').glob('*.json')).relative_to(self.root))
        for github,demo in [('', ''),('https://github.com/example/repo',''),('', 'https://demo.example.test'),('https://github.com/example/repo','https://demo.example.test')]:
            card=build.Document(build.project_card({**value,'github_url':github,'demo_url':demo}))
            self.assertEqual(len(card.root.find_all(cls='proj-action-github')),bool(github))
            self.assertEqual(len(card.root.find_all(cls='proj-action-demo')),bool(demo))
            self.assertEqual(len(card.root.find_all(cls='proj-actions')),bool(github or demo))
            for anchor in card.root.find_all(cls='proj-action'):
                self.assertEqual(anchor.attrs['target'],'_blank')
                self.assertIn('noopener',anchor.attrs['rel'])
        profile=self.json('content/profile.json')
        profile['badges']=[dict(icon='✦',title=f'Role {n}',subtitle='') for n in range(20)]
        profile['photo_tags']=[f'Skill {n}' for n in range(20)]
        self.write('content/profile.json',profile)
        value.update(id='twenty-tags',title='Twenty tags',tags=[f'Tag {n}' for n in range(20)])
        self.write('content/projects/twenty-tags.json',value)
        self.compile()
        self.assertEqual(len(self.document.root.find_all(cls='float-card')),20)
        self.assertIn('--badge-rows: 10',self.output)
        self.assertIn('Tag 19',self.output)
        profile['badges'].append(dict(icon='✦',title='One too many',subtitle=''))
        self.write('content/profile.json',profile)
        with self.assertRaisesRegex(ValueError,'at most 20'): self.compile()

    def test_uploaded_project_media_and_optional_fields(self):
        uploads=self.root/'uploads'
        uploads.mkdir(exist_ok=True)
        shutil.copyfile(self.root/'images/fr.png',uploads/'new-project.png')
        value=self.json(next((self.root/'content/projects').glob('*.json')).relative_to(self.root))
        value.update(id='media-project',title='Media project',thumbnail='/portfolio/uploads/new-project.png',
                     thumbnail_alt='Uploaded thumbnail',gallery=[dict(image='/portfolio/uploads/new-project.png',alt='Gallery alt',caption='Gallery caption')],
                     details='Longer **description**',start_date='2026-01-01',completion_date='2026-10-17',
                     demo_url='https://demo.example.com',documentation_url='https://docs.example.com',featured=False)
        self.write('content/projects/media-project.json',value)
        self.compile(site_url='https://owner.github.io/portfolio')
        for text in ['alt="Uploaded thumbnail"','alt="Gallery alt"','Gallery caption','Longer <strong>description</strong>','2026-01-01','2026-10-17','https://demo.example.com','https://docs.example.com']:
            self.assertIn(text,self.output)
        self.assertEqual(self.document.root.find_all(cls='proj-card')[-1].attrs['id'],'project-media-project')

    def test_project_covers_dates_gallery_view_all_and_lightbox(self):
        (self.root/'uploads').mkdir(exist_ok=True)
        shutil.copyfile(self.root/'images/fr.png',self.root/'uploads/new-project.png')
        self.compile(site_url='https://owner.github.io/portfolio')
        cards=self.document.root.find_all(cls='proj-card')
        self.assertEqual(len(cards),len(list((self.root/'content/projects').glob('*.json'))))
        self.assertEqual(cards[0].attrs['id'],'project-paperpilot')
        for card in cards:
            self.assertNotIn('hidden',card.attrs)
            self.assertEqual(len(card.find_all(cls='proj-cover-art')),1)
            self.assertEqual(len(card.find_all(cls='proj-cover-open')),bool(card.find_all(cls='proj-gallery')))
        self.assertIn('Added Oct 22, 2026',self.output)
        self.assertIn('Added Oct 18, 2026',self.output)
        self.assertIn('<span class="proj-cat">Research</span>',self.output)
        self.assertEqual(self.document.root.find_all(id='view-all-projects'),[])
        media=self.json('content/projects/bmi-calculator.json')
        media.update(id='doctor-cards',title='Doctor cards',category='Backend',order=10,featured=False,added_date='2026-11-05',
                     gallery=[dict(image='/portfolio/uploads/new-project.png',alt='Gallery alt',caption='Gallery caption') for _ in range(2)])
        for n,day in enumerate(['2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10']):
            extra={**media,'id':f'batch-{n}','title':f'Batch {n}','gallery':[dict(image='images/fr.png',alt=f'Batch alt {n}',caption=f'Batch shot {n}')],'added_date':day,'order':11+n}
            self.write(f'content/projects/batch-{n}.json',extra)
        self.write('content/projects/doctor-cards.json',media)
        self.compile(site_url='https://owner.github.io/portfolio')
        cards=self.document.root.find_all(cls='proj-card')
        total=len(cards)
        self.assertEqual(total,len(list((self.root/'content/projects').glob('*.json'))))
        self.assertEqual(cards[0].attrs['id'],'project-batch-4')
        extras=[card for card in cards if 'proj-extra' in card.attrs.get('class','')]
        self.assertEqual(len(extras),len(cards)-6)
        self.assertTrue(all('hidden' in card.attrs for card in extras))
        self.assertEqual(self.document.root.find(id='project-parking-management-system').find_all(cls='proj-cover-open'),[])
        self.assertEqual(len(self.document.root.find(id='project-batch-0').find_all(cls='proj-cover-open')),1)
        strip=self.document.root.find(id='project-doctor-cards').find(cls='proj-gallery')
        self.assertEqual(len(strip.find_all(cls='proj-thumb')),2)
        self.assertEqual(strip.find(cls='proj-thumb').attrs['data-full'],'/portfolio/uploads/new-project.png')
        self.assertEqual(strip.find(cls='proj-thumb').attrs['data-caption'],'Gallery caption')
        opener=self.document.root.find(id='project-doctor-cards').find_all(cls='proj-cover-open')
        self.assertEqual(len(opener),1)
        view=self.document.root.find_all(id='view-all-projects')
        self.assertEqual(len(view),1)
        self.assertIn('View all projects',self.document.outside(view[0]))
        self.assertIn(f'>{total}</span>',self.document.outside(view[0]))
        config=self.json('dist/admin/config.yml')
        fields=config['collections'][1]['fields']
        self.assertEqual(next(field for field in fields if field['name']=='added_date')['pattern'][0],'^$|^\\d{4}-\\d{2}-\\d{2}$')

    def test_broken_cv_and_asset_fail_build(self):
        self.write('content/resume.json',dict(file='uploads/missing.pdf'))
        with self.assertRaisesRegex(ValueError,'existing PDF'): self.compile()
        self.write('content/resume.json',dict(file='CV.pdf'))
        profile=self.json('content/profile.json');profile['profile_photo']='uploads/missing.png'
        self.write('content/profile.json',profile)
        with self.assertRaisesRegex(ValueError,'Missing asset'): self.compile()

    def test_certificate_thumbnails_preserve_text_and_destinations(self):
        achievements=self.json('content/achievements.json')
        original=achievements['items']
        original[0].update(thumbnail='images/thira.jpg',thumbnail_alt='Certificate "preview" <image>',credential_url='https://example.test/credential')
        original[1]['certificate']='https://example.test/certificate.pdf'
        self.write('content/achievements.json',achievements)
        self.compile()
        cards=self.document.root.find_all(cls='cert-card')
        self.assertEqual(len(cards),len(original))
        self.assertEqual(len(self.document.root.find_all(cls='cert-thumbnail')),2)
        for card,item in zip(cards,original):
            markup=self.document.outside(card)
            for field in ['title','organization','description','date']:
                self.assertIn(build.escape(item[field]),markup)
        image=cards[0].find(cls='cert-thumbnail')
        self.assertEqual(image.attrs['src'],'images/thira.jpg')
        self.assertEqual(image.attrs['alt'],'Certificate "preview" <image>')
        self.assertLess(image.start,cards[0].find(tag='h4').start)
        self.assertEqual(cards[0].find(cls='cert-action').attrs['href'],'https://example.test/credential')
        self.assertEqual(cards[0].find(cls='cert-action').attrs['target'],'_blank')
        self.assertEqual(cards[1].find_all(tag='img'),[])
        self.assertEqual(cards[1].find(cls='cert-action').attrs['href'],'https://example.test/certificate.pdf')
        self.assertEqual(cards[-1].find(cls='cert-thumbnail').attrs['src'],'images/thira.jpg')
        self.assertEqual(cards[-1].find(cls='cert-thumbnail').attrs['alt'],original[-1]['title'])
        config=self.json('dist/admin/config.yml')
        fields=next(file for file in config['collections'][0]['files'] if file['name']=='achievements')['fields'][0]['fields']
        self.assertEqual(next(field for field in fields if field['name']=='thumbnail')['widget'],'image')

    def test_gallery_default_covers_categories_and_custom_defaults(self):
        self.compile()
        self.assertEqual(len(self.document.root.find_all(cls='proj-thumbnail')),0)
        self.assertEqual(len(self.document.root.find_all(cls='cert-thumbnail')),1)
        for image in self.document.root.find_all(cls='proj-thumbnail'):
            self.assertEqual(image.attrs['src'],'images/project-default.svg')
        self.assertIn('Filter projects',self.output)
        self.assertIn('data-category="AI &amp; ML"',self.output)
        self.assertIn('data-filter="Research"',self.output)
        site=self.json('content/site-settings.json')
        site['media']={'project_fallback':'images/fr.png','certificate_fallback':'images/rr.jpg'}
        self.write('content/site-settings.json',site)
        self.compile()
        self.assertEqual(self.document.root.find(cls='proj-thumbnail').attrs['src'],'images/fr.png')
        self.assertEqual(self.document.root.find(cls='cert-thumbnail').attrs['src'],'images/rr.jpg')
        self.assertEqual(self.document.root.find_all(cls='cert-thumbnail')[-1].attrs['src'],'images/thira.jpg')

    def test_reviews_published_content_and_empty_state(self):
        self.compile()
        self.assertIn('href="#reviews"',self.output)
        self.assertEqual(len(self.document.root.find_all(cls='review-card')),4)
        self.assertEqual(len(self.document.root.find_all(cls='review-sample-label')),0)
        self.assertEqual(len(self.document.root.find_all(cls='review-rating')),0)
        self.assertIn('Reviewer approved',self.output)
        self.assertIn('Md. Mijanur Rahman',self.output)
        self.assertIn('Asaduzzaman Noor',self.output)
        self.assertIn('Abid Hasan',self.output)
        self.assertIn('Mamunur Rashid Alex',self.output)
        data=self.json('content/reviews.json')
        data['items']=[]
        self.write('content/reviews.json',data)
        self.compile()
        self.assertIn('Have we worked together?',self.output)
        self.assertNotIn('review-rating',self.output)
        data['items']=[dict(name='Test Reviewer',role='Test role',quote='<script>example</script> & feedback',rating=5,published=True,reviewer_approved=True,order=1,photo='images/fr.png',source_url='https://example.test/review'),dict(name='Hidden reviewer',quote='UNPUBLISHED REVIEW',published=False)]
        self.write('content/reviews.json',data)
        self.compile()
        self.assertIn('Test Reviewer',self.output)
        self.assertIn('&lt;script&gt;example&lt;/script&gt; &amp; feedback',self.output)
        self.assertNotIn('out of 5 stars',self.output)
        self.assertNotIn('UNPUBLISHED REVIEW',self.output)
        self.assertEqual(len(self.document.root.find_all(cls='review-invitation')),0)
        self.assertEqual(len(self.document.root.find_all(cls='review-card')),1)
        self.assertEqual(self.document.root.find(cls='review-source').attrs['target'],'_blank')
        data['items'][0]['rating']=6
        self.write('content/reviews.json',data)
        with self.assertRaisesRegex(ValueError,'number out of range'): self.compile()

    def test_sample_reviews_cannot_appear_as_approved_endorsements(self):
        data=self.json('content/reviews.json')
        data['items']=[dict(name='Fixture reviewer',quote='A proposed review.',sample=True,rating=5,source_url='https://example.test/review',published=True)]
        self.write('content/reviews.json',data)
        self.compile()
        self.assertIn('Sample review',self.output)
        self.assertNotIn('Sample rating',self.output)
        self.assertNotIn('Reviewer approved',self.output)
        self.assertEqual(len(self.document.root.find_all(cls='review-rating')),0)
        self.assertEqual(len(self.document.root.find_all(cls='review-source')),0)

    def test_review_carousel_supports_seven_entries_and_optional_quotes(self):
        data=self.json('content/reviews.json')
        data['items']=[dict(name=f'Fixture reviewer {n}',role='Fixture role',order=n,published=True) for n in range(7)]
        self.write('content/reviews.json',data)
        self.compile()
        self.assertEqual(len(self.document.root.find_all(cls='review-card')),7)
        self.assertEqual(len(self.document.root.find_all(cls='review-pending')),7)
        self.assertEqual(len(self.document.root.find_all(cls='review-carousel')),1)
        self.assertEqual(len(self.document.root.find_all(id='scrollCue')),1)
        self.assertEqual(self.document.root.find(id='site-footer').tag,'footer')

    def test_papers_crud_hide_and_external_links(self):
        paper=dict(id='fixture-paper',title='Fixture Paper',authors=['Fixture Author'],abstract='Fixture abstract',venue='Fixture Journal',year='2026',status='Preprint',paper_url='https://example.test/paper',doi='10.1234/fixture.2026',published=True,order=1)
        self.write('content/papers/fixture-paper.json',paper)
        self.compile()
        card=self.document.root.find(id='paper-fixture-paper')
        self.assertIn('Fixture Paper',self.output)
        self.assertIn('Fixture Author',self.output)
        self.assertIn('https://doi.org/10.1234/fixture.2026',self.output)
        for anchor in card.find_all(tag='a'):
            self.assertEqual(anchor.attrs['target'],'_blank')
            self.assertIn('noopener',anchor.attrs['rel'])
        config=self.json('dist/admin/config.yml')
        collection=next(item for item in config['collections'] if item['name']=='papers')
        self.assertTrue(collection['create'])
        self.assertTrue(collection['delete'])
        paper['title']='Edited Fixture Paper';self.write('content/papers/fixture-paper.json',paper)
        self.compile();self.assertIn('Edited Fixture Paper',self.output)
        paper['published']=False;self.write('content/papers/fixture-paper.json',paper)
        self.compile();self.assertNotIn('Edited Fixture Paper',self.output)
        self.assertTrue((self.root/'content/papers/fixture-paper.json').exists())
        (self.root/'content/papers/fixture-paper.json').unlink()
        self.compile();self.assertEqual(len(self.document.root.find_all(cls='paper-card')),0)

    def test_section_and_record_hide_controls(self):
        site=self.json('content/site-settings.json')
        for name in ['about','projects','research','skills','reviews','contact']: site['sections'][name]['visible']=False
        self.write('content/site-settings.json',site)
        self.compile()
        (build.ROOT/'.qa/hidden-sections.html').write_text(self.output,encoding='utf-8')
        for name in ['about','projects','research','skills','reviews','contact']:
            self.assertEqual(self.document.root.find_all(id=name),[])
            self.assertNotIn(f'href="#{name}"',self.output)
        self.assertIn('href="#experience"',self.output)
        # Saved content is retained and can be shown again.
        for name in site['sections']: site['sections'][name]['visible']=True
        self.write('content/site-settings.json',site)
        counts={}
        for name,key,cls in [('education','items','tl-item'),('experience','items','tl-item'),('achievements','items','cert-card'),('skills','categories','skill-card')]:
            content=self.json(f'content/{name}.json')
            content[key][0]['published']=False
            self.write(f'content/{name}.json',content)
        contact=self.json('content/contact.json');contact['links'][0]['published']=False
        self.write('content/contact.json',contact)
        self.compile()
        for cls,total in [('tl-item',3),('cert-card',7),('skill-card',5),('footer-social',3)]:
            self.assertEqual(len(self.document.root.find_all(cls=cls)),total)
        self.assertEqual(self.document.root.find_all(id='competitive'),[])
        self.assertNotIn('Find Me On',self.output)

    def test_certificate_counters_follow_add_hide_delete_and_manual_override(self):
        def assert_count(count):
            self.compile()
            self.assertIn(f'<div class="stat-num">{count}</div><div class="stat-label">Certifications</div>',self.output)
            self.assertIn(f'<div class="num">{count}</div><div class="lbl">Certs</div>',self.output)
        achievements=self.json('content/achievements.json')
        assert_count(8)
        achievements['items'].append({**achievements['items'][0],'title':'New certificate'})
        self.write('content/achievements.json',achievements)
        assert_count(9)
        achievements['items'][-1]['published']=False
        self.write('content/achievements.json',achievements)
        assert_count(8)
        achievements['items'].pop()
        achievements['items'].pop()
        self.write('content/achievements.json',achievements)
        assert_count(7)
        achievements['items']=[]
        self.write('content/achievements.json',achievements)
        assert_count(0)
        profile=self.json('content/profile.json')
        profile['statistics'][1].update(source='manual',value='Custom',suffix='')
        self.write('content/profile.json',profile)
        self.compile()
        self.assertIn('<div class="stat-num">Custom</div>',self.output)

    def test_uploaded_images_get_responsive_webp_with_alpha_and_prefix(self):
        from PIL import Image
        uploads=self.root/'uploads'
        uploads.mkdir(exist_ok=True)
        Image.new('RGBA',(800,1200),(10,120,80,128)).save(uploads/'uploaded-photo.png')
        profile=self.json('content/profile.json')
        profile['hero_photo']='/portfolio/uploads/uploaded-photo.png'
        self.write('content/profile.json',profile)
        self.compile(site_url='https://example.test/portfolio')
        hero=self.document.root.find(cls='hero-portrait')
        self.assertEqual(hero.attrs['src'],profile['hero_photo'])
        self.assertEqual(hero.parent.tag,'picture')
        source=hero.parent.find(tag='source')
        self.assertIn('240w',source.attrs['srcset'])
        self.assertIn('480w',source.attrs['srcset'])
        self.assertIn('720w',source.attrs['srcset'])
        for entry in source.attrs['srcset'].split(', '):
            image_path,width=entry.split(' ')
            with Image.open(self.root/'dist'/image_path) as image:
                self.assertEqual(image.width,int(width[:-1]))
                self.assertEqual(image.height,image.width*1.5)
                self.assertIn('A',image.getbands())
        self.assertTrue((self.root/'dist/uploads/uploaded-photo.png').exists())

    def test_review_admin_fields_roundtrip_and_visibility(self):
        reviews=self.json('content/reviews.json')
        reviews.update(autoplay=False,autoplay_seconds=8,initial_review=2,contact_prompt='CMS contact prompt',cta_label='CMS contact button')
        entry=dict(name='CMS added reviewer',role='CMS edited role',quote='CMS edited quote',rating=4,sample=False,reviewer_approved=True,highlight='CMS highlight',photo='images/fr.png',profile_url='https://example.test/profile',source_url='https://example.test/review',published=True,order=0)
        reviews['items'].append(entry)
        self.write('content/reviews.json',reviews)
        self.compile()
        for text in ['CMS added reviewer','CMS edited role','CMS edited quote','CMS highlight','CMS contact prompt','CMS contact button','https://example.test/profile','https://example.test/review','data-autoplay="false"','data-delay="8000"','data-initial="2"']:
            self.assertIn(text,self.output)
        config=self.json('dist/admin/config.yml')
        fields=next(file for file in config['collections'][0]['files'] if file['name']=='reviews')['fields']
        editable={field['name'] for field in fields[0]['fields']}
        self.assertTrue(set(entry)<=editable)
        entry['published']=False;self.write('content/reviews.json',reviews)
        self.compile();self.assertNotIn('CMS added reviewer',self.output)
        reviews['items'].pop();self.write('content/reviews.json',reviews)
        self.compile();self.assertEqual(len(self.document.root.find_all(cls='review-card')),4)

    def test_project_path_and_custom_domain_configuration(self):
        for site_url,base in [('https://example.github.io/portfolio','/portfolio'),('https://portfolio.example.com','')]:
            self.compile(repository='owner/portfolio',branch='production',site_url=site_url,prefix='rabbi-portfolio-main')
            config=self.json('dist/admin/config.yml')
            self.assertEqual(config['public_folder'],base+'/uploads')
            self.assertEqual(config['media_folder'],'rabbi-portfolio-main/uploads')
            self.assertEqual(config['backend']['branch'],'production')
            self.assertEqual(config['collections'][0]['files'][0]['file'],'rabbi-portfolio-main/content/profile.json')
            self.assertIn('href="'+site_url+'/"',self.output)

    def test_authentication_disabled_until_explicit_configuration(self):
        settings=self.json('cms/settings.json')
        settings.update(enabled=False,oauth_base_url='')
        self.write('cms/settings.json',settings)
        self.compile(repository='owner/repo',site_url='https://owner.github.io/repo')
        self.assertFalse(self.json('dist/admin/status.json')['configured'])
        settings=self.json('cms/settings.json')
        settings.update(enabled=True,oauth_base_url='https://oauth.example.com')
        self.write('cms/settings.json',settings)
        self.compile(repository='owner/repo',site_url='https://owner.github.io/repo')
        self.assertTrue(self.json('dist/admin/status.json')['configured'])

    def test_invalid_values_and_duplicate_ids_fail_build(self):
        item=self.json(next((self.root/'content/projects').glob('*.json')).relative_to(self.root))
        self.write('content/projects/duplicate.json',item)
        with self.assertRaisesRegex(ValueError,'Duplicate project ID'): self.compile()
        (self.root/'content/projects/duplicate.json').unlink()
        skills=self.json('content/skills.json');skills['categories'][0]['items'][0]['percent']=101
        self.write('content/skills.json',skills)
        with self.assertRaisesRegex(ValueError,'number out of range'): self.compile()

    def test_cms_schema_has_no_empty_object_fields(self):
        self.compile()
        def check(fields):
            for field in fields:
                if field['widget']=='object': self.assertGreater(len(field.get('fields',[])),0)
                if 'fields' in field: check(field['fields'])
        for definitions in self.json('cms/schema.json').values(): check(definitions)

    def test_xss_and_script_config_escaping(self):
        profile=self.json('content/profile.json');profile['introduction']='<script>alert(1)</script>'
        profile['biography']=['<img src=x onerror=alert(1)> **safe**']
        self.write('content/profile.json',profile)
        site=self.json('content/site-settings.json');site['form']['success_message']='</script><script>alert(2)</script>'
        self.write('content/site-settings.json',site)
        self.compile()
        self.assertNotIn('<script>alert(',self.output)
        self.assertIn('&lt;script&gt;',self.output)
        self.assertIn('\\u003c/script\\u003e',self.output)
        profile['secondary_cta_url']='javascript:alert(1)'
        self.write('content/profile.json',profile)
        with self.assertRaisesRegex(ValueError,'Unsupported URL'): self.compile()

    def test_optional_fields_and_empty_lists(self):
        profile=self.json('content/profile.json')
        for name in ['badges','statistics','photo_tags','about_tags','about_statistics','biography']: profile[name]=[]
        profile['available']=False
        self.write('content/profile.json',profile)
        for name,key in [('education','items'),('experience','items'),('achievements','items'),('skills','categories')]:
            self.write(f'content/{name}.json',{key:[]})
        self.compile()
        self.assertNotIn('Available for Collaboration',self.output)

    def test_optional_verification_and_credential_id(self):
        self.compile()
        self.assertEqual(len(self.document.root.find_all(cls='credential-id')),0)
        self.assertNotIn('27fe77ddc368',self.output)
        data=self.json('content/achievements.json')
        item=data['items'][1]
        item.update(credential_url='https://issuer.example.test/verify/real-id',certificate='images/thira.jpg',credential_id='Readable-ID',show_credential_id=True)
        self.write('content/achievements.json',data)
        self.compile()
        card=self.document.root.find_all(cls='cert-card')[1]
        actions=card.find_all(cls='cert-action')
        self.assertEqual(len(actions),2)
        self.assertEqual(actions[0].attrs['href'],item['credential_url'])
        self.assertEqual(actions[1].attrs['href'],item['certificate'])
        self.assertTrue(all(a.attrs['target']=='_blank' for a in actions))
        self.assertIn('Credential ID: Readable-ID',self.output)
        item.update(credential_url='',certificate='',show_credential_id=False)
        self.write('content/achievements.json',data)
        self.compile()
        self.assertEqual(self.document.root.find_all(cls='cert-card')[1].find_all(cls='cert-action'),[])
        self.assertNotIn('Readable-ID',self.output)

    def test_output_cannot_overwrite_sources(self):
        with self.assertRaisesRegex(ValueError,'dedicated source-root/dist'):
            build.build(self.root,output=self.root)


if __name__ == '__main__': unittest.main()
