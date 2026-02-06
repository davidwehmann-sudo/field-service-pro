import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { action } = await req.json();

        // Get all verifications
        const verifications = await base44.asServiceRole.entities.PartVerification.list();

        // Find duplicates (same part_number + machine_model)
        const duplicateGroups = {};
        
        verifications.forEach(v => {
            const key = `${v.part_number?.toLowerCase()}_${v.machine_model?.toLowerCase()}`;
            if (!duplicateGroups[key]) {
                duplicateGroups[key] = [];
            }
            duplicateGroups[key].push(v);
        });

        // Filter to only groups with duplicates
        const duplicates = Object.entries(duplicateGroups)
            .filter(([_, group]) => group.length > 1)
            .map(([key, group]) => ({
                key,
                part_number: group[0].part_number,
                machine_model: group[0].machine_model,
                count: group.length,
                entries: group.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
            }));

        if (action === 'analyze') {
            // Just return the analysis
            return Response.json({
                success: true,
                total_verifications: verifications.length,
                duplicate_groups: duplicates.length,
                total_duplicates: duplicates.reduce((sum, g) => sum + (g.count - 1), 0),
                duplicates: duplicates.map(d => ({
                    part_number: d.part_number,
                    machine_model: d.machine_model,
                    count: d.count,
                    oldest: d.entries[d.entries.length - 1].created_date,
                    newest: d.entries[0].created_date
                }))
            });
        }

        if (action === 'cleanup') {
            // Keep newest, delete older ones
            const deleted = [];
            
            for (const group of duplicates) {
                // Keep the first (newest), delete the rest
                for (let i = 1; i < group.entries.length; i++) {
                    await base44.asServiceRole.entities.PartVerification.delete(group.entries[i].id);
                    deleted.push({
                        id: group.entries[i].id,
                        part_number: group.entries[i].part_number,
                        machine_model: group.entries[i].machine_model
                    });
                }
            }

            return Response.json({
                success: true,
                deleted_count: deleted.length,
                kept_count: duplicates.length,
                deleted: deleted
            });
        }

        return Response.json({ error: 'Invalid action. Use "analyze" or "cleanup"' }, { status: 400 });

    } catch (error) {
        console.error('Cleanup error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});